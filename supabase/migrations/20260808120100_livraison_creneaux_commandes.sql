-- =============================================================================
-- 0002 — Livraison, carburant, créneaux, commandes, paiements
-- Référence : docs/01-ARCHITECTURE.md §3.5 à §3.8, docs/02-MOTEURS-METIER.md
-- =============================================================================

-- =============================================================================
-- LIVRAISON
-- =============================================================================

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  vehicle_type text not null check (vehicle_type in ('spl','camion','fourgon','remorque')),
  capacity_m3 numeric(10,3) not null check (capacity_m3 > 0),
  capacity_pallets integer,
  fuel_consumption_l_per_100km numeric(6,2) not null default 25,
  max_distance_km integer,
  -- Usure au kilomètre, hors carburant. Souvent 0 au démarrage.
  cost_per_km_cents integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index vehicles_company_idx on vehicles (company_id, is_active);

create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  color text,
  base_fee_cents integer not null default 0,
  fee_per_m3_cents integer not null default 0,
  free_above_cents integer,
  min_order_amount_cents integer not null default 0,
  min_order_volume_m3 numeric(10,3) not null default 0,
  distance_km_estimate integer,
  -- Jours ISO : 1 = lundi … 7 = dimanche.
  delivery_days integer[] not null default '{1,2,3,4,5}',
  lead_time_days integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index delivery_zones_company_idx on delivery_zones (company_id, is_active);

-- La table que l'admin manipule le plus : commune → zone.
create table zone_communes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- null = commune connue mais NON DESSERVIE (bascule vers le devis).
  zone_id uuid references delivery_zones(id) on delete set null,
  postal_code text not null,
  city text not null,
  insee_code text,
  distance_km numeric(6,1),
  delivery_days integer[],
  is_served boolean not null default true,
  notes text,
  unique (company_id, postal_code, city)
);
create index zone_communes_lookup_idx on zone_communes (company_id, postal_code);

-- Historique du gazole : source open data officielle (docs/02 §2.4).
create table fuel_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fuel_type text not null default 'gazole',
  price_per_liter_cents integer not null check (price_per_liter_cents > 0),
  source text not null,
  sample_size integer,
  department text,
  recorded_at timestamptz not null default now()
);
create index fuel_prices_recent_idx on fuel_prices (company_id, recorded_at desc);

-- =============================================================================
-- CRÉNEAUX
-- =============================================================================

create table slot_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  label text not null,
  max_deliveries integer not null default 8 check (max_deliveries > 0),
  -- ⚠️ LA vraie contrainte : 8 livraisons de 10 m³ ≠ 8 livraisons de 2 m³.
  max_volume_m3 numeric(10,3) not null default 20 check (max_volume_m3 > 0),
  vehicle_id uuid references vehicles(id) on delete set null,
  zone_ids uuid[] not null default '{}',
  is_active boolean not null default true
);

create table delivery_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  template_id uuid references slot_templates(id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  label text not null,
  max_deliveries integer not null,
  max_volume_m3 numeric(10,3) not null,
  booked_deliveries integer not null default 0,
  booked_volume_m3 numeric(10,3) not null default 0,
  vehicle_id uuid references vehicles(id) on delete set null,
  zone_ids uuid[] not null default '{}',
  is_open boolean not null default true,
  closed_reason text,
  unique (company_id, date, start_time, end_time)
);
create index delivery_slots_date_idx on delivery_slots (company_id, date);

create table slot_blackouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  applies_to_zone_ids uuid[] not null default '{}',
  check (end_date >= start_date)
);

-- =============================================================================
-- PANIER (serveur : les prix sont revalidés à chaque lecture, docs/02 §10)
-- =============================================================================

create table carts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  postal_code text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger carts_updated_at before update on carts
  for each row execute function set_updated_at();

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity numeric(10,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- =============================================================================
-- PROMOTIONS — jamais lisibles côté client (sinon on expose tous les codes)
-- =============================================================================

create table promotions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text,
  discount_type text not null check (discount_type in ('percent','fixed','free_delivery')),
  discount_value integer not null default 0,
  min_order_cents integer not null default 0,
  min_volume_m3 numeric(10,3) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  max_uses_per_customer integer not null default 1,
  used_count integer not null default 0,
  applies_to_variant_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

-- =============================================================================
-- COMMANDES
-- =============================================================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  reference text not null,
  customer_id uuid references customers(id) on delete set null,
  is_guest boolean not null default false,
  status text not null default 'nouvelle' check (status in (
    'nouvelle','en_attente_paiement','payee','a_preparer','prete','planifiee','livree','annulee'
  )),
  email citext not null,
  phone text,
  first_name text,
  last_name text,
  fulfillment_type text not null default 'delivery'
    check (fulfillment_type in ('delivery','pickup')),
  -- Snapshot complet : l'adresse peut être modifiée ou supprimée ensuite.
  shipping_address jsonb,
  zone_id uuid references delivery_zones(id) on delete set null,
  distance_km numeric(6,1),
  vehicle_id uuid references vehicles(id) on delete set null,
  slot_id uuid references delivery_slots(id) on delete set null,
  requested_slot_label text,
  confirmed_delivery_date date,
  confirmed_slot_label text,
  delivery_notes text,
  internal_notes text,
  -- Montants TTC en centimes.
  subtotal_cents integer not null default 0,
  options_cents integer not null default 0,
  discount_cents integer not null default 0,
  delivery_base_cents integer not null default 0,
  delivery_volume_cents integer not null default 0,
  delivery_fuel_cents integer not null default 0,
  delivery_total_cents integer not null default 0,
  delivery_offered_cents integer not null default 0,
  total_cents integer not null default 0,
  vat_breakdown jsonb not null default '[]'::jsonb,
  total_volume_m3 numeric(10,3) not null default 0,
  payment_method text check (payment_method in ('card','cash','check','transfer','sumup')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','deposit_paid','paid','refunded','failed')),
  deposit_required_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  promotion_id uuid references promotions(id) on delete set null,
  promotion_code text,
  cgv_version text,
  cgv_accepted_at timestamptz,
  -- Traçabilité du calcul : indispensable en cas de litige.
  fuel_price_snapshot_cents integer,
  pricing_snapshot jsonb,
  source text not null default 'web' check (source in ('web','admin','phone')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, reference)
);
create index orders_status_idx on orders (company_id, status, created_at desc);
create index orders_delivery_date_idx on orders (company_id, confirmed_delivery_date);
create index orders_customer_idx on orders (customer_id);
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- Accès invité : token opaque, JAMAIS la référence seule (devinable).
create table order_access_tokens (
  token text primary key,
  order_id uuid not null references orders(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  -- Snapshot : le produit peut changer ou disparaître après la commande.
  product_name text not null,
  variant_label text not null,
  sku text not null,
  species_label text,
  cut_length_cm integer,
  humidity_class text,
  packaging text,
  quantity numeric(10,3) not null,
  unit text not null,
  unit_volume_m3 numeric(10,3) not null,
  line_volume_m3 numeric(10,3) not null,
  unit_price_cents integer not null,
  line_total_cents integer not null,
  vat_rate numeric(5,2) not null,
  is_backorder boolean not null default false
);
create index order_items_order_idx on order_items (order_id);

create table order_option_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  option_id uuid references product_options(id) on delete set null,
  name text not null,
  price_cents integer not null,
  vat_rate numeric(5,2) not null default 20.00
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references profiles(id) on delete set null,
  actor text not null default 'admin' check (actor in ('admin','system','driver','customer')),
  note text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on order_status_history (order_id, created_at desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  method text not null check (method in ('card','cash','check','transfer','sumup')),
  kind text not null default 'full' check (kind in ('deposit','full','balance')),
  amount_cents integer not null,
  status text not null check (status in ('pending','succeeded','failed','refunded')),
  stripe_payment_intent_id text,
  stripe_charge_id text,
  received_at timestamptz,
  recorded_by uuid references profiles(id) on delete set null,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);
create unique index payments_stripe_pi_idx on payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index payments_order_idx on payments (order_id);

-- Idempotence des webhooks Stripe : un rejeu ne doit rien rejouer.
create table processed_webhook_events (
  event_id text primary key,
  provider text not null default 'stripe',
  processed_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references orders(id) on delete restrict,
  number text not null,
  issued_at date not null default current_date,
  -- Données STRUCTURÉES, pas seulement un PDF : prépare Factur-X (PLAN.md §3.7).
  seller jsonb not null,
  buyer jsonb not null,
  lines jsonb not null,
  totals jsonb not null,
  vat_breakdown jsonb not null default '[]'::jsonb,
  storage_path text,
  is_credit_note boolean not null default false,
  parent_invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, number)
);

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  reference text not null,
  status text not null default 'nouveau'
    check (status in ('nouveau','en_cours','envoye','accepte','refuse')),
  first_name text,
  last_name text,
  company_name text,
  email citext not null,
  phone text,
  address_line1 text,
  postal_code text,
  city text,
  species text,
  cut_length_cm integer,
  quantity_m3 numeric(10,3),
  humidity_preference text,
  message text,
  origin text not null default 'form'
    check (origin in ('form','out_of_zone','large_order','fee_too_high')),
  cart_snapshot jsonb,
  estimated_total_cents integer,
  admin_notes text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, reference)
);
create index quote_requests_status_idx on quote_requests (company_id, status, created_at desc);

-- =============================================================================
-- STOCK, NOTIFICATIONS, AUDIT
-- =============================================================================

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  movement_type text not null check (movement_type in (
    'production','reservation','release','shipment','adjustment','loss'
  )),
  quantity numeric(12,3) not null,
  stock_after numeric(12,3) not null,
  order_id uuid references orders(id) on delete set null,
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_variant_idx on stock_movements (company_id, variant_id, created_at desc);

-- Transforme une rupture en prospect.
create table stock_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  email citext not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (variant_id, email)
);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  template text not null,
  recipient text not null,
  order_id uuid references orders(id) on delete set null,
  status text not null check (status in ('queued','sent','failed')),
  provider_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (company_id, entity_type, entity_id, created_at desc);

-- Séquences légales par entreprise et par année (factures sans trou).
create table document_sequences (
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null check (kind in ('order','invoice','quote')),
  year integer not null,
  last_value integer not null default 0,
  primary key (company_id, kind, year)
);
