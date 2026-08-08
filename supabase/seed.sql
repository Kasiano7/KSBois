-- =============================================================================
-- SEED — jeu de démonstration
--
-- Sert à : développer sans base réelle, alimenter l'environnement `preview` que
-- le client valide avant l'ouverture, et vérifier l'ISOLATION MULTI-TENANT.
--
-- Deux entreprises sont créées : la vraie (Ardèche) et une entreprise témoin
-- (Savoie). Aucune requête ne doit jamais faire remonter les données de l'une
-- dans l'autre — c'est le test de qualité de l'architecture.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENTREPRISE 1 — le client pilote
-- -----------------------------------------------------------------------------
insert into companies (
  id, slug, name, legal_name, email, phone, phone_display,
  address_line1, postal_code, city, depot_lat, depot_lng,
  vat_mode, pricing_basis
) values (
  '11111111-1111-1111-1111-111111111111',
  'bois-ardeche',
  'Bois de chauffage',
  'À COMPLÉTER — raison sociale',
  'contact@exemple.fr',
  '0475000000',
  '04 75 00 00 00',
  'À COMPLÉTER',
  '07690',
  'Villevocance',
  45.2478, 4.5619,     -- Villevocance, Ardèche nord
  'assujetti',
  'map_delivered'      -- ⚠️ PLAN.md §3.3 — à confirmer par écrit
);

insert into company_domains (company_id, hostname, is_primary) values
  ('11111111-1111-1111-1111-111111111111', 'localhost', true),
  ('11111111-1111-1111-1111-111111111111', 'localhost:3000', false);

insert into company_themes (company_id, tokens) values (
  '11111111-1111-1111-1111-111111111111',
  '{"ecorce":"#171310","aubier":"#F4F2EC","sapin":"#22392C","braise":"#C4501B","braise-texte":"#A83F12","seve":"#D9A441"}'::jsonb
);

insert into company_features (company_id, pellets, pallets, nets, services)
values ('11111111-1111-1111-1111-111111111111', false, false, false, false);

insert into company_settings (company_id, key, value) values
  ('11111111-1111-1111-1111-111111111111', 'order.lead_time_days', '3'),
  ('11111111-1111-1111-1111-111111111111', 'order.booking_horizon_days', '45'),
  ('11111111-1111-1111-1111-111111111111', 'order.min_volume_m3', '1'),
  -- Plafond légal du paiement en espèces par un particulier résident.
  ('11111111-1111-1111-1111-111111111111', 'payment.cash_limit_cents', '100000'),
  ('11111111-1111-1111-1111-111111111111', 'payment.deposit_percent', '30'),
  ('11111111-1111-1111-1111-111111111111', 'payment.deposit_trigger_volume_m3', '10'),
  ('11111111-1111-1111-1111-111111111111', 'payment.deposit_trigger_km', '45'),
  ('11111111-1111-1111-1111-111111111111', 'delivery.rounding_step_cents', '50'),
  ('11111111-1111-1111-1111-111111111111', 'delivery.max_fee_cents', '15000'),
  ('11111111-1111-1111-1111-111111111111', 'fuel.margin_coefficient', '1.0'),
  ('11111111-1111-1111-1111-111111111111', 'fuel.max_surcharge_cents', '3000'),
  ('11111111-1111-1111-1111-111111111111', 'fuel.fallback_price_cents', '175'),
  ('11111111-1111-1111-1111-111111111111', 'legal.cgv_version', '"2026-08"');

-- Essences (nord Ardèche)
insert into wood_species (company_id, code, name, hardness_group, calorific_kwh_per_m3, description, warning, sort_order) values
  ('11111111-1111-1111-1111-111111111111','chene','Chêne','G1',2000,'Braise longue, chaleur durable',null,1),
  ('11111111-1111-1111-1111-111111111111','hetre','Hêtre','G1',2050,'Le meilleur compromis flamme et braise',null,2),
  ('11111111-1111-1111-1111-111111111111','charme','Charme','G1',2100,'Le plus calorifique',null,3),
  ('11111111-1111-1111-1111-111111111111','frene','Frêne','G1',1950,'Brûle même peu sec',null,4),
  ('11111111-1111-1111-1111-111111111111','chataignier','Châtaignier','G2',1500,'Très présent en Ardèche','Projections — déconseillé en cheminée ouverte',5),
  ('11111111-1111-1111-1111-111111111111','bouleau','Bouleau','G2',1600,'Belle flamme, se consume vite',null,6);

-- Longueurs de coupe et coefficients d'empilage (PLAN.md §3.2)
insert into cut_lengths (company_id, cm, label, stacking_coefficient, hint, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 25,'25 cm',0.650,'petits poêles et inserts compacts',1),
  ('11111111-1111-1111-1111-111111111111', 33,'33 cm',0.700,'la taille la plus courante, convient à la majorité des poêles',2),
  ('11111111-1111-1111-1111-111111111111', 40,'40 cm',0.750,'inserts et foyers larges',3),
  ('11111111-1111-1111-1111-111111111111', 50,'50 cm',0.800,'grandes cheminées et chaudières',4),
  ('11111111-1111-1111-1111-111111111111',100,'1 m',1.000,'à recouper soi-même, le meilleur rapport qualité-prix',5);

insert into product_categories (id, company_id, slug, name, description, sort_order) values
  ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'buches','Bûches de chauffage','Bois dur coupé et fendu, livré chez vous.',1);

insert into products (id, company_id, category_id, slug, name, short_description, description, product_type, badges, is_featured) values
  ('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   '22222222-0000-0000-0000-000000000001',
   'chene-hetre-charme','Chêne, hêtre et charme',
   'Mélange de bois durs, séché deux ans, humidité mesurée.',
   'Notre offre principale : un mélange de bois durs issus de nos coupes du nord de l''Ardèche. Séché deux ans sous hangar ventilé. Chaque lot est mesuré au testeur avant mise en vente.',
   'buches', array['local','sec'], true);

-- Variantes : prix réels communiqués par le client, au m³ apparent livré.
insert into product_variants (
  id, company_id, product_id, sku, cut_length_id, humidity_class,
  measured_humidity_pct, measured_at, batch_label,
  base_price_cents, vat_rate, min_quantity, quantity_step,
  stock_on_hand, low_stock_threshold, sort_order
)
select
  ('44444444-0000-0000-0000-00000000000' || row_number() over (order by cl.cm))::uuid,
  '11111111-1111-1111-1111-111111111111',
  '33333333-0000-0000-0000-000000000001',
  'BUCHE-' || cl.cm,
  cl.id, 'H1', 17.0, date '2026-09-12', 'lot de septembre 2026',
  case cl.cm when 25 then 10700 when 33 then 10400 when 40 then 10200
             when 50 then 10000 else 8500 end,
  10.00, 1, 0.5,
  case cl.cm when 33 then 42 when 50 then 28 when 25 then 15 else 20 end,
  5, cl.sort_order
from cut_lengths cl
where cl.company_id = '11111111-1111-1111-1111-111111111111';

-- Paliers dégressifs : -4 € dès 3 m³, -8 € dès 6, -12 € dès 10.
insert into price_tiers (company_id, variant_id, min_quantity, unit_price_cents, sort_order)
select v.company_id, v.id, t.q, v.base_price_cents - t.remise, t.ord
from product_variants v
cross join (values (3, 400, 1), (6, 800, 2), (10, 1200, 3)) as t(q, remise, ord)
where v.company_id = '11111111-1111-1111-1111-111111111111';

-- Véhicules
insert into vehicles (company_id, name, vehicle_type, capacity_m3, fuel_consumption_l_per_100km, max_distance_km, sort_order) values
  ('11111111-1111-1111-1111-111111111111','Fourgon','fourgon',4,12,null,1),
  ('11111111-1111-1111-1111-111111111111','Camion benne','camion',15,28,null,2),
  ('11111111-1111-1111-1111-111111111111','Semi-remorque','spl',40,35,120,3);

-- Zones (rayon 60 km)
insert into delivery_zones (id, company_id, name, base_fee_cents, fee_per_m3_cents, free_above_cents, min_order_volume_m3, distance_km_estimate, delivery_days, sort_order) values
  ('55555555-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Zone A — 0 à 15 km',0,0,null,1,10,'{1,2,3,4,5}',1),
  ('55555555-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Zone B — 15 à 30 km',1500,0,50000,2,22,'{2,4}',2),
  ('55555555-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Zone C — 30 à 45 km',2500,100,null,3,37,'{4}',3),
  ('55555555-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Zone D — 45 à 60 km',4000,150,null,5,52,'{4}',4);

-- Communes réelles du secteur
insert into zone_communes (company_id, zone_id, postal_code, city, distance_km, is_served) values
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000001','07690','Villevocance',2,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000001','07690','Vanosc',6,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000001','07100','Annonay',12,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000001','07100','Boulieu-lès-Annonay',14,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002','07430','Davézieux',15,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002','07100','Roiffieux',16,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002','07290','Quintenas',20,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002','42220','Saint-Julien-Molin-Molette',24,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002','07340','Serrières',28,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000003','07370','Sarras',34,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000003','26600','Tain-l''Hermitage',42,true),
  ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000004','07300','Tournon-sur-Rhône',48,true),
  -- Hors zone : bascule automatique vers le devis.
  ('11111111-1111-1111-1111-111111111111', null,'07000','Privas',72,false);

-- Prix du gazole de repli (le cron le remplacera dès le premier passage).
insert into fuel_prices (company_id, price_per_liter_cents, source, department)
values ('11111111-1111-1111-1111-111111111111', 175, 'seed', '07');

-- Créneaux : mardi et jeudi, matin et après-midi.
-- ⚠️ La capacité en VOLUME est la vraie contrainte, pas le nombre.
insert into slot_templates (company_id, weekday, start_time, end_time, label, max_deliveries, max_volume_m3) values
  ('11111111-1111-1111-1111-111111111111', 2,'08:00','12:00','Matin (8h – 12h)',6,18),
  ('11111111-1111-1111-1111-111111111111', 2,'14:00','18:00','Après-midi (14h – 18h)',6,18),
  ('11111111-1111-1111-1111-111111111111', 4,'08:00','12:00','Matin (8h – 12h)',6,18),
  ('11111111-1111-1111-1111-111111111111', 4,'14:00','18:00','Après-midi (14h – 18h)',6,18);

select generate_delivery_slots('11111111-1111-1111-1111-111111111111', 45);

-- -----------------------------------------------------------------------------
-- COMPTES D'EXPLOITATION DE DÉMONSTRATION
--
-- ⚠️ Ici et PAS dans une migration : les migrations s'exécutent AVANT le seed,
-- donc une migration ne peut pas dépendre de l'existence de l'entreprise.
-- Un compte de démo est de la donnée, pas du schéma.
--
-- ⚠️ Les colonnes de jetons de auth.users doivent valoir '' et non NULL :
-- GoTrue les lit comme des chaînes non nulles et rejette sinon la connexion
-- avec un « Invalid login credentials » trompeur.
--
-- La procédure de mise en production (docs/06 §5) crée le compte réel du patron
-- et supprime ceux-ci. Le mot de passe trivial ne protège qu'un jeu fictif.
-- -----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','patron@demo.local', crypt('demo1234', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', ''),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','secretariat@demo.local', crypt('demo1234', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', '');

-- Identité requise par GoTrue pour autoriser la connexion par email.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'email',
   '{"sub":"a0000000-0000-4000-8000-000000000001","email":"patron@demo.local","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000002', 'email',
   '{"sub":"a0000000-0000-4000-8000-000000000002","email":"secretariat@demo.local","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now(), now());

insert into profiles (id, email, full_name) values
  ('a0000000-0000-4000-8000-000000000001','patron@demo.local','Patron (démo)'),
  ('a0000000-0000-4000-8000-000000000002','secretariat@demo.local','Secrétariat (démo)');

insert into company_members (company_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-000000000001','owner'),
  ('11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-000000000002','staff');

-- -----------------------------------------------------------------------------
-- ENTREPRISE 2 — témoin, pour vérifier l'isolation multi-tenant
-- -----------------------------------------------------------------------------
insert into companies (id, slug, name, email, postal_code, city, depot_lat, depot_lng)
values ('99999999-9999-9999-9999-999999999999','bois-savoie','Bois des Alpes',
        'contact@temoin.test','73000','Chambéry',45.5646,5.9178);

insert into company_domains (company_id, hostname, is_primary)
values ('99999999-9999-9999-9999-999999999999','temoin.localhost', true);

insert into company_themes (company_id, tokens)
values ('99999999-9999-9999-9999-999999999999','{"braise":"#1D4ED8"}'::jsonb);

insert into company_features (company_id, pellets)
values ('99999999-9999-9999-9999-999999999999', true);

insert into cut_lengths (company_id, cm, label, stacking_coefficient, sort_order)
values ('99999999-9999-9999-9999-999999999999', 33,'33 cm',0.700,1);

insert into products (id, company_id, slug, name, product_type)
values ('88888888-0000-0000-0000-000000000001','99999999-9999-9999-9999-999999999999',
        'sapin-temoin','Produit témoin Savoie','buches');

insert into product_variants (company_id, product_id, sku, base_price_cents, stock_on_hand)
values ('99999999-9999-9999-9999-999999999999','88888888-0000-0000-0000-000000000001',
        'TEMOIN-33', 9900, 10);
