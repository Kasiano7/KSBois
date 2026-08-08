-- =============================================================================
-- 0005 — Privilèges de table (GRANT)
--
-- ⚠️ RLS et GRANT sont DEUX barrières distinctes, et il faut les deux :
--   • GRANT sans RLS  → tout le monde voit tout.
--   • RLS sans GRANT  → personne ne voit rien (l'application est cassée).
--
-- Stratégie retenue — défense en profondeur :
--   `anon`          : privilège de LECTURE uniquement sur ce qui est
--                     intrinsèquement public (le catalogue affiché sur le site),
--                     plus l'INSERT des deux formulaires publics.
--                     Il n'a AUCUN privilège sur clients, commandes, paiements,
--                     promotions, réglages : même si une policy était mal
--                     écrite, Postgres refuserait au niveau du privilège.
--   `authenticated` : privilèges larges, filtrés par les policies RLS.
--
-- Le panier n'est PAS exposé : il est manipulé exclusivement par des Server
-- Actions, côté serveur (docs/02 §10).
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- service_role — la clé serveur. Elle contourne la RLS (attribut BYPASSRLS),
-- mais il lui faut malgré tout les privilèges de table : RLS et GRANT sont deux
-- mécanismes indépendants. Sans ces lignes, tout le code serveur reçoit
-- « permission denied », y compris la résolution du tenant.
-- -----------------------------------------------------------------------------
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Catalogue et configuration publique — lecture pour tous
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'companies','company_domains','company_themes','company_features',
    'wood_species','cut_lengths','product_categories','products','product_variants',
    'price_tiers','product_options','media','product_media',
    'vehicles','delivery_zones','zone_communes','delivery_slots'
  ]
  loop
    execute format('grant select on %I to anon, authenticated', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Formulaires publics — insertion seule, jamais de lecture
-- -----------------------------------------------------------------------------
grant insert on quote_requests to anon, authenticated;
grant insert on stock_alerts to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Espace client et back-office — filtrage assuré par les policies RLS
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','company_members','customers','addresses',
    'orders','order_items','order_option_items','order_status_history',
    'payments','invoices','quote_requests','stock_movements',
    'slot_templates','slot_blackouts','promotions','company_settings',
    'product_categories','products','product_variants','price_tiers',
    'product_options','media','product_media','wood_species','cut_lengths',
    'vehicles','delivery_zones','zone_communes','delivery_slots',
    'companies','company_domains','company_themes','company_features'
  ]
  loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end;
$$;

-- Lecture seule pour l'exploitant : ces tables ne se modifient pas à la main.
grant select on fuel_prices, notifications_log, audit_log, stock_alerts to authenticated;

-- -----------------------------------------------------------------------------
-- Tables strictement serveur : AUCUN privilège, pour personne.
-- Elles ne sont accessibles qu'avec la clé service_role.
--   • order_access_tokens      → résolution des commandes invité
--   • document_sequences       → numérotation légale des factures
--   • processed_webhook_events → idempotence Stripe
--   • carts / cart_items       → panier serveur
-- -----------------------------------------------------------------------------
revoke all on order_access_tokens, document_sequences, processed_webhook_events,
              carts, cart_items
  from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Fonctions transactionnelles : exécutables uniquement côté serveur.
-- Un client authentifié ne doit pas pouvoir réserver du stock à la main.
-- -----------------------------------------------------------------------------
revoke execute on function
  apply_stock_movement(uuid, text, numeric, uuid, text, uuid),
  reserve_order_stock(uuid),
  release_order_stock(uuid),
  ship_order_stock(uuid),
  book_slot(uuid, uuid),
  release_slot(uuid),
  generate_delivery_slots(uuid, integer),
  next_document_number(uuid, text)
  from anon, authenticated, public;

-- …mais elles restent exécutables par le serveur, qui les appelle via rpc().
grant execute on function
  apply_stock_movement(uuid, text, numeric, uuid, text, uuid),
  reserve_order_stock(uuid),
  release_order_stock(uuid),
  ship_order_stock(uuid),
  book_slot(uuid, uuid),
  release_slot(uuid),
  generate_delivery_slots(uuid, integer),
  next_document_number(uuid, text)
  to service_role;

-- Les fonctions d'aide RLS doivent rester appelables : les policies les invoquent.
grant execute on function
  has_company_role(uuid, text[]),
  is_company_staff(uuid),
  is_company_owner(uuid),
  current_customer_id(uuid)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Les futures tables héritent des mêmes règles.
-- -----------------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
