-- =============================================================================
-- TEST D'ISOLATION MULTI-TENANT
--
-- Critère de recette du lot 0 : « un test automatisé prouve qu'une entreprise
-- ne peut pas lire les données d'une autre ».
--
-- Exécution :
--   docker exec -i supabase_db_bois-chauffage psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/rls_isolation.sql
--
-- Le script ÉCHOUE bruyamment (exception) si une fuite est détectée.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- -----------------------------------------------------------------------------
-- Deux comptes : un gérant côté Ardèche, un gérant côté Savoie.
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','patron.ardeche@test.local','x',now(),now(),now()),
  ('bbbbbbbb-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','patron.savoie@test.local','x',now(),now(),now())
on conflict (id) do nothing;

insert into profiles (id, email, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001','patron.ardeche@test.local','Patron Ardèche'),
  ('bbbbbbbb-0000-0000-0000-000000000002','patron.savoie@test.local','Patron Savoie')
on conflict (id) do nothing;

insert into company_members (company_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','owner'),
  ('99999999-9999-9999-9999-999999999999','bbbbbbbb-0000-0000-0000-000000000002','owner')
on conflict do nothing;

-- Une donnée confidentielle de chaque côté.
insert into customers (id, company_id, email, first_name, last_name, internal_notes) values
  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'client.ardeche@test.local','Jean','Dupont','Client fidèle — remise possible'),
  ('cccccccc-0000-0000-0000-000000000002','99999999-9999-9999-9999-999999999999',
   'client.savoie@test.local','Marc','Durand','Mauvais payeur')
on conflict (id) do nothing;

insert into orders (id, company_id, reference, customer_id, email, total_cents, total_volume_m3) values
  ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'CMD-TEST-ARDECHE','cccccccc-0000-0000-0000-000000000001','client.ardeche@test.local',50000,5),
  ('dddddddd-0000-0000-0000-000000000002','99999999-9999-9999-9999-999999999999',
   'CMD-TEST-SAVOIE','cccccccc-0000-0000-0000-000000000002','client.savoie@test.local',30000,3)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Harnais
-- -----------------------------------------------------------------------------
-- Deux assertions seulement, volontairement : « je vois » et « je ne vois pas ».
-- Pas de comptage exact, qui casserait au moindre ajout dans le seed.
create or replace function assert_visible(p_label text, p_actual bigint)
returns void language plpgsql as $$
begin
  if p_actual < 1 then
    raise exception 'ÉCHEC — % : aucune ligne visible, au moins 1 attendue', p_label;
  end if;
  raise notice 'OK   — % (% ligne(s))', p_label, p_actual;
end;
$$;

create or replace function assert_hidden(p_label text, p_actual bigint)
returns void language plpgsql as $$
begin
  if p_actual <> 0 then
    raise exception 'FUITE — % : % ligne(s) visible(s), 0 attendue', p_label, p_actual;
  end if;
  raise notice 'OK   — %', p_label;
end;
$$;

-- =============================================================================
-- SCÉNARIO 1 — le patron ardéchois, authentifié
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
begin
  perform assert_visible('Ardèche voit SES clients',
    (select count(*) from customers where company_id = '11111111-1111-1111-1111-111111111111'));
  perform assert_hidden('Ardèche NE VOIT PAS les clients de Savoie',
    (select count(*) from customers where company_id = '99999999-9999-9999-9999-999999999999'));

  perform assert_visible('Ardèche voit SES commandes',
    (select count(*) from orders where company_id = '11111111-1111-1111-1111-111111111111'));
  perform assert_hidden('Ardèche NE VOIT PAS les commandes de Savoie',
    (select count(*) from orders where company_id = '99999999-9999-9999-9999-999999999999'));

  perform assert_visible('Ardèche voit SES réglages',
    (select count(*) from company_settings where company_id = '11111111-1111-1111-1111-111111111111'));
  perform assert_hidden('Ardèche NE VOIT PAS les réglages de Savoie',
    (select count(*) from company_settings where company_id = '99999999-9999-9999-9999-999999999999'));

  perform assert_hidden('Ardèche NE VOIT PAS le stock de Savoie',
    (select count(*) from stock_movements where company_id = '99999999-9999-9999-9999-999999999999'));
  perform assert_hidden('Ardèche NE VOIT PAS les promotions de Savoie',
    (select count(*) from promotions where company_id = '99999999-9999-9999-9999-999999999999'));
end;
$$;

-- Écriture croisée : doit être refusée par la policy WITH CHECK.
do $$
begin
  begin
    insert into customers (company_id, email) values
      ('99999999-9999-9999-9999-999999999999','intrus@test.local');
    raise exception 'ÉCHEC — Ardèche a pu ÉCRIRE chez Savoie';
  exception when insufficient_privilege or check_violation then
    raise notice 'OK   — écriture croisée Ardèche → Savoie refusée';
  end;
end;
$$;

-- =============================================================================
-- SCÉNARIO 2 — le patron savoyard : symétrie
-- =============================================================================
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
begin
  perform assert_visible('Savoie voit SES clients',
    (select count(*) from customers where company_id = '99999999-9999-9999-9999-999999999999'));
  perform assert_hidden('Savoie NE VOIT PAS les clients d''Ardèche',
    (select count(*) from customers where company_id = '11111111-1111-1111-1111-111111111111'));
  perform assert_hidden('Savoie NE VOIT PAS les commandes d''Ardèche',
    (select count(*) from orders where company_id = '11111111-1111-1111-1111-111111111111'));
  perform assert_hidden('Savoie NE VOIT PAS les réglages d''Ardèche',
    (select count(*) from company_settings where company_id = '11111111-1111-1111-1111-111111111111'));
end;
$$;

-- =============================================================================
-- SCÉNARIO 3 — visiteur anonyme
-- Le catalogue est public par nature (il est affiché sur le site).
-- En revanche AUCUNE donnée confidentielle ne doit fuir.
-- =============================================================================
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  perform assert_visible('Anonyme voit le catalogue public',
    (select count(*) from products where company_id = '11111111-1111-1111-1111-111111111111'));
  perform assert_visible('Anonyme voit les créneaux ouverts',
    (select count(*) from delivery_slots));
end;
$$;

-- Sur ces tables, `anon` n'a AUCUN privilège : la requête doit échouer au
-- niveau du privilège, avant même d'atteindre les policies. C'est la seconde
-- barrière — on vérifie qu'elle existe bien.
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'customers','orders','payments','invoices','promotions','company_settings',
    'fuel_prices','stock_movements','audit_log','document_sequences',
    'order_access_tokens','carts','processed_webhook_events'
  ]
  loop
    begin
      execute format('select count(*) from %I', t) into n;
      -- Pas d'exception : il reste une policy pour filtrer. Elle doit tout masquer.
      if n <> 0 then
        raise exception 'FUITE — anonyme lit % : % ligne(s)', t, n;
      end if;
      raise notice 'OK   — anonyme ne lit rien dans % (policy)', t;
    exception when insufficient_privilege then
      raise notice 'OK   — anonyme n''a aucun privilège sur % (GRANT)', t;
    end;
  end loop;
end;
$$;

reset role;
rollback;
