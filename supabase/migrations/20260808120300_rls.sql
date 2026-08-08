-- =============================================================================
-- 0004 — Row Level Security
-- Référence : docs/01-ARCHITECTURE.md §4
--
-- RLS ACTIVÉE SUR 100 % DES TABLES. Aucune exception.
-- C'est la ligne de défense qui survit à une erreur applicative : même si une
-- Server Action oublie un contrôle, Postgres refuse la lecture inter-tenant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'aide
-- -----------------------------------------------------------------------------

create or replace function has_company_role(cid uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from company_members
    where user_id = auth.uid() and company_id = cid and role = any(roles)
  );
$$;

create or replace function is_company_staff(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select has_company_role(cid, array['owner','staff','driver']); $$;

create or replace function is_company_owner(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select has_company_role(cid, array['owner']); $$;

-- Le client courant, pour une entreprise donnée.
create or replace function current_customer_id(cid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from customers where company_id = cid and user_id = auth.uid() limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Activation globale
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'companies','company_domains','company_themes','company_features','company_settings',
    'profiles','company_members','customers','addresses',
    'wood_species','cut_lengths','product_categories','products','product_variants',
    'price_tiers','product_options','media','product_media',
    'vehicles','delivery_zones','zone_communes','fuel_prices',
    'slot_templates','delivery_slots','slot_blackouts',
    'carts','cart_items','promotions',
    'orders','order_access_tokens','order_items','order_option_items',
    'order_status_history','payments','processed_webhook_events','invoices',
    'quote_requests','stock_movements','stock_alerts','notifications_log',
    'audit_log','document_sequences'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end;
$$;

-- =============================================================================
-- CONFIGURATION PUBLIQUE — lisible par tous si l'entreprise est active
-- =============================================================================

create policy companies_public_read on companies
  for select using (is_active);
create policy companies_owner_all on companies
  for all using (is_company_owner(id)) with check (is_company_owner(id));

create policy company_domains_public_read on company_domains
  for select using (true);
create policy company_domains_owner_all on company_domains
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

create policy company_themes_public_read on company_themes
  for select using (true);
create policy company_themes_owner_all on company_themes
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

create policy company_features_public_read on company_features
  for select using (true);
create policy company_features_owner_all on company_features
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

-- ⚠️ company_settings : AUCUN accès public. Contient plafond espèces, seuils
-- d'acompte, etc. — lu côté serveur via service_role uniquement.
create policy company_settings_owner_all on company_settings
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

-- =============================================================================
-- UTILISATEURS
-- =============================================================================

create policy profiles_self on profiles
  for select using (id = auth.uid());
create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy company_members_self_read on company_members
  for select using (user_id = auth.uid() or is_company_owner(company_id));
create policy company_members_owner_all on company_members
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

create policy customers_self on customers
  for select using (user_id = auth.uid() or is_company_staff(company_id));
create policy customers_self_update on customers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy customers_staff_all on customers
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy addresses_self on addresses
  for all
  using (customer_id = current_customer_id(company_id) or is_company_staff(company_id))
  with check (customer_id = current_customer_id(company_id) or is_company_staff(company_id));

-- =============================================================================
-- CATALOGUE — lecture publique des éléments actifs, écriture réservée
-- =============================================================================

create policy wood_species_public_read on wood_species for select using (is_active);
create policy wood_species_staff_all on wood_species
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy cut_lengths_public_read on cut_lengths for select using (is_active);
create policy cut_lengths_staff_all on cut_lengths
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy product_categories_public_read on product_categories for select using (is_active);
create policy product_categories_staff_all on product_categories
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy products_public_read on products for select using (is_active);
create policy products_staff_all on products
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy product_variants_public_read on product_variants for select using (is_active);
create policy product_variants_staff_all on product_variants
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy price_tiers_public_read on price_tiers for select using (true);
create policy price_tiers_staff_all on price_tiers
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy product_options_public_read on product_options for select using (is_active);
create policy product_options_staff_all on product_options
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy media_public_read on media for select using (true);
create policy media_staff_all on media
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy product_media_public_read on product_media for select using (true);
create policy product_media_staff_all on product_media
  for all using (
    exists (select 1 from products p where p.id = product_id and is_company_staff(p.company_id))
  ) with check (
    exists (select 1 from products p where p.id = product_id and is_company_staff(p.company_id))
  );

-- =============================================================================
-- LIVRAISON
-- =============================================================================

create policy vehicles_public_read on vehicles for select using (is_active);
create policy vehicles_owner_all on vehicles
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

create policy delivery_zones_public_read on delivery_zones for select using (is_active);
create policy delivery_zones_owner_all on delivery_zones
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

create policy zone_communes_public_read on zone_communes for select using (true);
create policy zone_communes_staff_all on zone_communes
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

-- Prix carburant : non public (c'est une donnée de calcul interne).
create policy fuel_prices_staff_read on fuel_prices
  for select using (is_company_staff(company_id));

create policy slot_templates_staff_all on slot_templates
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

-- Créneaux : le public ne voit que les créneaux ouverts et à venir.
create policy delivery_slots_public_read on delivery_slots
  for select using (is_open and date >= current_date);
create policy delivery_slots_staff_all on delivery_slots
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy slot_blackouts_staff_all on slot_blackouts
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

-- =============================================================================
-- PANIER — accès par possession de l'identifiant (cookie httpOnly)
-- =============================================================================

create policy carts_owner on carts
  for all
  using (customer_id is null or customer_id = current_customer_id(company_id)
         or is_company_staff(company_id))
  with check (customer_id is null or customer_id = current_customer_id(company_id)
              or is_company_staff(company_id));

create policy cart_items_owner on cart_items
  for all
  using (exists (select 1 from carts c where c.id = cart_id))
  with check (exists (select 1 from carts c where c.id = cart_id));

-- =============================================================================
-- PROMOTIONS — ⚠️ JAMAIS lisibles côté client
-- Sinon on expose tous les codes actifs. La validation se fait côté serveur,
-- qui répond seulement « valide / invalide + montant ».
-- =============================================================================

create policy promotions_staff_all on promotions
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

-- =============================================================================
-- COMMANDES
-- =============================================================================

create policy orders_customer_read on orders
  for select using (
    (customer_id is not null and customer_id = current_customer_id(company_id))
    or is_company_staff(company_id)
  );
create policy orders_staff_all on orders
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

-- Les tokens d'accès invité ne sont jamais lus par le client : le serveur seul
-- les résout, via service_role.
create policy order_access_tokens_staff on order_access_tokens
  for select using (
    exists (select 1 from orders o where o.id = order_id and is_company_staff(o.company_id))
  );

create policy order_items_read on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (o.customer_id = current_customer_id(o.company_id) or is_company_staff(o.company_id))
    )
  );
create policy order_items_staff_all on order_items
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy order_option_items_staff_all on order_option_items
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy order_status_history_staff on order_status_history
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

create policy payments_read on payments
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (o.customer_id = current_customer_id(o.company_id) or is_company_staff(o.company_id))
    )
  );
-- Écriture de paiement : owner uniquement (le staff saisit via une action serveur
-- contrôlée, jamais en écriture directe).
create policy payments_owner_write on payments
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

create policy invoices_read on invoices
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (o.customer_id = current_customer_id(o.company_id) or is_company_staff(o.company_id))
    )
  );
create policy invoices_owner_write on invoices
  for all using (is_company_owner(company_id)) with check (is_company_owner(company_id));

-- Webhooks : table purement serveur.
create policy processed_webhook_events_none on processed_webhook_events
  for select using (false);

-- =============================================================================
-- DEVIS — insertion publique (formulaire), lecture réservée
-- =============================================================================

create policy quote_requests_public_insert on quote_requests
  for insert with check (true);
create policy quote_requests_staff_all on quote_requests
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

-- =============================================================================
-- STOCK, ALERTES, JOURNAUX
-- =============================================================================

create policy stock_movements_staff on stock_movements
  for all using (is_company_staff(company_id)) with check (is_company_staff(company_id));

-- Le visiteur peut demander à être prévenu d'un réapprovisionnement.
create policy stock_alerts_public_insert on stock_alerts
  for insert with check (true);
create policy stock_alerts_staff_read on stock_alerts
  for select using (is_company_staff(company_id));

create policy notifications_log_staff_read on notifications_log
  for select using (is_company_staff(company_id));

create policy audit_log_staff_read on audit_log
  for select using (is_company_staff(company_id));

-- Séquences légales : serveur uniquement.
create policy document_sequences_none on document_sequences
  for select using (false);
