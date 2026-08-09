-- =============================================================================
-- Statistiques d'exploitation et instrumentation anonyme du parcours client
-- Références : docs/01 §3.9, docs/02 §11 et docs/05 §8.
--
-- Les montants historiques restent lus depuis les commandes. Ces deux tables
-- ne servent qu'aux étapes qui n'existent pas dans une commande : visite,
-- panier, contrôle de zone, créneau, paiement et demandes perdues.
-- Aucune IP, adresse, email ou identité client n'est conservée ici.
-- =============================================================================

create table analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  acquisition_source text not null default 'unknown'
    check (acquisition_source in ('direct','seo','referral','campaign','unknown')),
  landing_path text,
  referrer_host text,
  campaign text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index analytics_sessions_period_idx
  on analytics_sessions (company_id, started_at desc);
create index analytics_sessions_source_idx
  on analytics_sessions (company_id, acquisition_source, started_at desc);

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  session_id uuid not null references analytics_sessions(id) on delete cascade,
  cart_id uuid references carts(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  quote_request_id uuid references quote_requests(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  zone_id uuid references delivery_zones(id) on delete set null,
  event_type text not null check (
    event_type in (
      'visit','cart','zone_check','slot','payment','order','quote_pdf','lost_demand'
    )
  ),
  reason text check (
    reason is null or reason in (
      'out_of_zone','unknown_postal_code','out_of_stock','no_slot','payment_failed'
    )
  ),
  potential_revenue_cents integer check (
    potential_revenue_cents is null or potential_revenue_cents >= 0
  ),
  potential_volume_m3 numeric(10,3) check (
    potential_volume_m3 is null or potential_volume_m3 >= 0
  ),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- Une session ne franchit chaque étape qu'une fois. Les pertes restent, elles,
-- répétables : deux formats en rupture sont deux occasions perdues distinctes.
create unique index analytics_events_funnel_once_idx
  on analytics_events (company_id, session_id, event_type)
  where event_type in ('visit','cart','zone_check','slot','payment','order','quote_pdf');
create index analytics_events_period_idx
  on analytics_events (company_id, event_type, occurred_at desc);
create index analytics_events_loss_idx
  on analytics_events (company_id, reason, occurred_at desc)
  where event_type = 'lost_demand';
create index analytics_events_order_idx
  on analytics_events (order_id)
  where order_id is not null;

-- Attribution figée sur la commande : les statistiques SEO et devis PDF ne
-- dépendent pas de la durée de conservation plus courte des événements.
alter table orders
  add column analytics_session_id uuid references analytics_sessions(id) on delete set null,
  add column acquisition_source text check (
    acquisition_source is null or acquisition_source in ('direct','seo','referral','campaign','unknown')
  ),
  add column quote_pdf_before_order boolean not null default false;

create index orders_acquisition_idx
  on orders (company_id, acquisition_source, created_at desc)
  where acquisition_source is not null;

-- Réglages éditables : ils pilotent les priorités de production et la fenêtre
-- de réactivation. Les valeurs sont des défauts d'installation, pas des
-- constantes cachées dans l'interface.
insert into company_settings (company_id, key, value)
select id, 'statistics.stock_velocity_days', '90'::jsonb from companies
on conflict (company_id, key) do nothing;

insert into company_settings (company_id, key, value)
select id, 'statistics.stock_urgent_days', '14'::jsonb from companies
on conflict (company_id, key) do nothing;

insert into company_settings (company_id, key, value)
select id, 'statistics.stock_warning_days', '30'::jsonb from companies
on conflict (company_id, key) do nothing;

insert into company_settings (company_id, key, value)
select id, 'statistics.reactivation_window_days', '45'::jsonb from companies
on conflict (company_id, key) do nothing;

insert into company_settings (company_id, key, value)
select id, 'statistics.reactivation_overdue_days', '90'::jsonb from companies
on conflict (company_id, key) do nothing;

-- RLS + privilèges : aucun navigateur n'écrit directement. La route serveur
-- valide les événements et utilise service_role ; le personnel ne fait que lire.
alter table analytics_sessions enable row level security;
alter table analytics_sessions force row level security;
alter table analytics_events enable row level security;
alter table analytics_events force row level security;

create policy analytics_sessions_staff_read on analytics_sessions
  for select using (is_company_staff(company_id));
create policy analytics_events_staff_read on analytics_events
  for select using (is_company_staff(company_id));

revoke all on analytics_sessions, analytics_events from anon, authenticated, public;
grant select on analytics_sessions, analytics_events to authenticated;
grant all privileges on analytics_sessions, analytics_events to service_role;
