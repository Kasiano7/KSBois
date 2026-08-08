-- =============================================================================
-- 0001 — Socle multi-tenant, utilisateurs, catalogue
-- Référence : docs/01-ARCHITECTURE.md §3
--
-- Règles : montants en centimes entiers, volumes en numeric(10,3),
-- company_id obligatoire sur toute table métier.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- Horodatage automatique
-- -----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- ENTREPRISES (tenants)
-- =============================================================================

create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  legal_name text,
  siret text,
  rcs text,
  vat_number text,
  ape_code text,
  email citext not null,
  phone text,
  phone_display text,
  address_line1 text,
  postal_code text,
  city text,
  -- Point de départ des tournées : sert au calcul des distances.
  depot_lat numeric(9,6),
  depot_lng numeric(9,6),
  vat_mode text not null default 'assujetti'
    check (vat_mode in ('assujetti','franchise_en_base')),
  -- ⚠️ PLAN.md §3.3 — à confirmer par écrit avec chaque entreprise.
  pricing_basis text not null default 'map_delivered'
    check (pricing_basis in ('map_delivered','stere_1m_equivalent')),
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Paris',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_updated_at before update on companies
  for each row execute function set_updated_at();

-- Résolution du tenant par nom de domaine (src/proxy.ts).
create table company_domains (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  hostname text unique not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index company_domains_company_idx on company_domains (company_id);

-- Thème white-label : changer 6 valeurs hex + un logo suffit à rhabiller le site.
create table company_themes (
  company_id uuid primary key references companies(id) on delete cascade,
  tokens jsonb not null default '{}'::jsonb,
  logo_media_id uuid,
  logo_dark_media_id uuid,
  favicon_media_id uuid,
  font_display text not null default 'Fraunces',
  font_body text not null default 'Archivo',
  updated_at timestamptz not null default now()
);

-- Interrupteurs de fonctionnalités : le levier du modèle white-label.
create table company_features (
  company_id uuid primary key references companies(id) on delete cascade,
  pellets boolean not null default false,
  kindling boolean not null default true,
  pallets boolean not null default false,
  nets boolean not null default false,
  pickup boolean not null default true,
  services boolean not null default false,
  promotions boolean not null default true,
  sms boolean not null default false,
  quotes boolean not null default true,
  fuel_surcharge boolean not null default true,
  route_optimization boolean not null default false,
  blog boolean not null default true,
  needs_calculator boolean not null default true
);

-- Réglages divers, pour éviter une migration par seuil configurable.
-- ⚠️ Contient des valeurs sensibles (plafond espèces, déclencheur d'acompte) :
-- lecture SERVEUR uniquement, jamais exposée au client (docs/01 §4.2).
create table company_settings (
  company_id uuid not null references companies(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, key)
);

-- =============================================================================
-- UTILISATEURS
-- =============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner','staff','driver')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_members_user_idx on company_members (user_id);

-- Un client peut exister SANS compte : la commande invité est le parcours par défaut.
create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  email citext not null,
  phone text,
  first_name text,
  last_name text,
  is_company boolean not null default false,
  company_name text,
  siret text,
  vat_number text,
  customer_type text not null default 'particulier'
    check (customer_type in ('particulier','professionnel')),
  internal_notes text,
  is_blocked boolean not null default false,
  accepts_marketing boolean not null default false,
  total_orders integer not null default 0,
  total_spent_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_company_email_idx on customers (company_id, email);
create index customers_user_idx on customers (user_id);
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

create table addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  label text,
  first_name text,
  last_name text,
  phone text,
  line1 text not null,
  line2 text,
  postal_code text not null,
  city text not null,
  insee_code text,
  lat numeric(9,6),
  lng numeric(9,6),
  -- Contraintes d'accès : le champ qui évite 90 % des livraisons ratées.
  access_notes text,
  truck_access text not null default 'camion'
    check (truck_access in ('spl','camion','fourgon','remorque_seule')),
  unload_type text check (unload_type in ('vrac_sol','range','benne')),
  has_slope boolean not null default false,
  has_gate boolean not null default false,
  allow_unattended_delivery boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_customer_idx on addresses (customer_id);

-- =============================================================================
-- CATALOGUE
-- =============================================================================

create table wood_species (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  hardness_group text check (hardness_group in ('G1','G2','G3')),
  calorific_kwh_per_m3 integer,
  description text,
  warning text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (company_id, code)
);

-- ⚠️ stacking_coefficient : PLAN.md §3.2. Éditable depuis l'admin, jamais en dur.
create table cut_lengths (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  cm integer not null check (cm > 0),
  label text not null,
  stacking_coefficient numeric(4,3) not null check (stacking_coefficient > 0),
  hint text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (company_id, cm)
);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  hero_media_id uuid,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  unique (company_id, slug)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category_id uuid references product_categories(id) on delete set null,
  slug text not null,
  name text not null,
  short_description text,
  description text,
  species_ids uuid[] not null default '{}',
  product_type text not null default 'buches'
    check (product_type in ('buches','granules','allumage','service')),
  badges text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);
create index products_company_active_idx on products (company_id, is_active);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sku text not null,
  cut_length_id uuid references cut_lengths(id) on delete restrict,
  humidity_class text check (humidity_class in ('H1','H2','H3')),
  measured_humidity_pct numeric(4,1),
  measured_at date,
  batch_label text,
  packaging text not null default 'vrac'
    check (packaging in ('vrac','palette','filet','sac')),
  unit text not null default 'm3app'
    check (unit in ('m3app','palette','filet','sac','tonne')),
  unit_volume_m3 numeric(10,3) not null default 1.000,
  unit_weight_kg numeric(10,2),
  base_price_cents integer not null check (base_price_cents >= 0),
  compare_at_price_cents integer,
  vat_rate numeric(5,2) not null default 10.00,
  min_quantity numeric(10,3) not null default 1,
  max_quantity numeric(10,3),
  quantity_step numeric(10,3) not null default 1,
  stock_on_hand numeric(12,3) not null default 0,
  stock_reserved numeric(12,3) not null default 0,
  -- Colonne générée : jamais écrite directement.
  stock_available numeric(12,3)
    generated always as (stock_on_hand - stock_reserved) stored,
  low_stock_threshold numeric(12,3) not null default 5,
  allow_backorder boolean not null default false,
  backorder_available_at date,
  track_stock boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, sku)
);
create index product_variants_product_idx on product_variants (product_id);
create trigger product_variants_updated_at before update on product_variants
  for each row execute function set_updated_at();

create table price_tiers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  min_quantity numeric(10,3) not null check (min_quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  sort_order integer not null default 0,
  unique (variant_id, min_quantity)
);
create index price_tiers_variant_idx on price_tiers (variant_id);

create table product_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  price_cents integer not null default 0,
  price_type text not null default 'fixed' check (price_type in ('fixed','per_m3')),
  vat_rate numeric(5,2) not null default 20.00,
  applies_to text not null default 'order' check (applies_to in ('order','variant')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  unique (company_id, code)
);

-- =============================================================================
-- MÉDIAS (ImageKit) — on stocke le CHEMIN, jamais l'URL complète (docs/04 §3)
-- =============================================================================

create table media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  imagekit_file_id text not null,
  file_path text not null,
  file_name text not null,
  media_type text not null check (media_type in ('image','video')),
  mime text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric(8,2),
  lqip text,
  -- Obligatoire pour publier : contrainte d'accessibilité ET de SEO.
  alt_text text,
  caption text,
  credit text,
  tags text[] not null default '{}',
  folder text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, imagekit_file_id)
);
create index media_company_folder_idx on media (company_id, folder);

create table product_media (
  product_id uuid not null references products(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  primary key (product_id, media_id)
);

alter table company_themes
  add constraint company_themes_logo_fk foreign key (logo_media_id) references media(id) on delete set null,
  add constraint company_themes_logo_dark_fk foreign key (logo_dark_media_id) references media(id) on delete set null,
  add constraint company_themes_favicon_fk foreign key (favicon_media_id) references media(id) on delete set null;

alter table product_categories
  add constraint product_categories_hero_fk foreign key (hero_media_id) references media(id) on delete set null;
