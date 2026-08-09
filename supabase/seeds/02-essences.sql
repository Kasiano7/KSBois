-- =============================================================================
-- SEED 02 — Gammes d'essences
--
-- Le modèle du plan (PLAN.md §2.2) est : UN PRODUIT = UNE ESSENCE OU GAMME,
-- UNE VARIANTE = une longueur de coupe. Le client choisit donc une longueur
-- (axe variante) et une essence (axe produit) ; l'intersection désigne la
-- variante à mettre au panier.
--
-- ⚠️ PRIX À CONFIRMER. Seule la gamme « Chêne / Hêtre » porte les prix réels
-- communiqués par le client (107 / 104 / 102 / 100 €). Les écarts des autres
-- gammes sont des hypothèses plausibles à valider avant ouverture :
--   • Chêne pur        : +6 €/m³app  (essence recherchée, braise longue)
--   • Mix bois durs    : −4 €/m³app  (mélange moins sélectif)
--   • Bois tendre      : −28 €/m³app (résineux, pouvoir calorifique inférieur)
--
-- Le bois tendre n'est volontairement proposé qu'en 33 et 50 cm : c'est réaliste
-- et cela permet de vérifier l'état « longueur indisponible » de l'interface.
-- =============================================================================

-- Sous-titre affiché sur la carte de sélection d'essence.
insert into products (
  id, company_id, category_id, slug, name, short_description, description,
  product_type, badges, is_active, is_featured, sort_order
) values
  ('33333333-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
   '22222222-0000-0000-0000-000000000001',
   'chene','Chêne','Braise longue, chaleur durable',
   'Chêne pur issu de nos coupes. C''est l''essence qui tient le plus longtemps en braise : idéale pour une chauffe de nuit ou un poêle qu''on ne recharge pas souvent. Séché deux ans sous hangar ventilé.',
   'buches', array['local','sec'], true, false, 2),

  ('33333333-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',
   '22222222-0000-0000-0000-000000000001',
   'mix-bois-durs','Mix bois durs','Chêne, hêtre, frêne, charme',
   'Mélange de feuillus durs selon nos coupes de la saison. Le meilleur rapport chaleur-prix pour un usage quotidien. Séché deux ans sous hangar ventilé.',
   'buches', array['local','sec'], true, false, 3),

  ('33333333-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',
   '22222222-0000-0000-0000-000000000001',
   'bois-tendre','Bois tendre','Résineux — allumage et mi-saison',
   'Résineux (douglas, épicéa). Monte vite en température, se consume plus rapidement : parfait pour allumer, pour les journées de mi-saison, ou en complément d''un bois dur. Attention aux dépôts de suie : un ramonage annuel reste indispensable.',
   'buches', array['local'], true, false, 4)
-- Idempotent : ce fichier est chargé par glob au reset et peut être rejoué à la
-- main sur une base existante sans tout casser.
on conflict (id) do nothing;

-- Le produit d'origine devient explicitement la gamme « Chêne / Hêtre ».
update products
set name = 'Chêne / Hêtre',
    short_description = 'Le plus vendu',
    slug = 'chene-hetre',
    sort_order = 1
where id = '33333333-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- Variantes : une par longueur, avec l'écart de prix propre à la gamme.
-- -----------------------------------------------------------------------------
insert into product_variants (
  company_id, product_id, sku, cut_length_id, humidity_class,
  measured_humidity_pct, measured_at, batch_label,
  base_price_cents, vat_rate, min_quantity, quantity_step,
  stock_on_hand, low_stock_threshold, sort_order
)
select
  '11111111-1111-1111-1111-111111111111',
  g.product_id,
  g.prefixe || '-' || cl.cm,
  cl.id,
  g.humidite,
  g.humidite_pct,
  date '2026-09-12',
  'lot de septembre 2026',
  -- Prix de base de la gamme Chêne/Hêtre pour cette longueur, plus l'écart.
  (case cl.cm when 25 then 10700 when 33 then 10400 when 40 then 10200
              when 50 then 10000 else 8500 end) + g.ecart_cents,
  10.00, 1, 0.5,
  g.stock_initial,
  5,
  cl.sort_order
from cut_lengths cl
-- Jointure interne (et non CROSS JOIN, qui n'accepte pas de clause ON) :
-- chaque gamme ne déclare que les longueurs qu'elle propose réellement.
join (values
  ('33333333-0000-0000-0000-000000000002'::uuid, 'CHENE',  600::int,  'H1', 17.0::numeric, 24::numeric, array[25,33,40,50]),
  ('33333333-0000-0000-0000-000000000003'::uuid, 'MIX',   -400::int,  'H1', 18.0::numeric, 36::numeric, array[25,33,40,50]),
  ('33333333-0000-0000-0000-000000000004'::uuid, 'TENDRE',-2800::int, 'H1', 16.0::numeric, 18::numeric, array[33,50])
) as g(product_id, prefixe, ecart_cents, humidite, humidite_pct, stock_initial, longueurs)
  on cl.cm = any(g.longueurs)
where cl.company_id = '11111111-1111-1111-1111-111111111111'
on conflict (company_id, sku) do nothing;

-- Paliers dégressifs : même règle pour toutes les gammes.
insert into price_tiers (company_id, variant_id, min_quantity, unit_price_cents, sort_order)
select v.company_id, v.id, t.q, v.base_price_cents - t.remise, t.ord
from product_variants v
join products p on p.id = v.product_id
cross join (values (3, 400, 1), (6, 800, 2), (10, 1200, 3)) as t(q, remise, ord)
where v.company_id = '11111111-1111-1111-1111-111111111111'
  and p.slug in ('chene', 'mix-bois-durs', 'bois-tendre')
on conflict (variant_id, min_quantity) do nothing;
