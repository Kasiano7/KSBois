-- ============================================================================
-- Jeu de démonstration pour les écrans de pilotage — LOCAL UNIQUEMENT
--
-- Pourquoi ce fichier existe : la base de départ ne contient AUCUNE commande.
-- Les écrans « Tableau de bord » et « Statistiques » s'affichaient donc à zéro,
-- et il était impossible de vérifier qu'une courbe est lisible, qu'un axe se
-- gradue correctement ou qu'un anneau se répartit bien.
--
-- ⚠️ Volontairement HORS du glob `./seeds/*.sql` de `supabase/config.toml` :
-- il ne s'exécute donc PAS à chaque `npm run db:reset`, et ne partira jamais
-- vers un environnement hébergé par inadvertance. Il se lance à la main :
--
--     npm run db:demo
--
-- Il est idempotent : il supprime d'abord les données qu'il a créées, repérées
-- par le préfixe de référence « DEMO- » et le domaine email « demo.test ».
-- Aucun stock n'est mouvementé : ces commandes sont de l'HISTORIQUE, pas des
-- réservations. Les fonctions transactionnelles restent la seule voie pour
-- créer une vraie commande (PLAN.md, règle 5).
-- ============================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
  entreprise uuid := '11111111-1111-1111-1111-111111111111';
  -- Ancrage temporel : « maintenant », arrondi au jour, en UTC.
  aujourd_hui date := (now() at time zone 'utc')::date;

  variantes uuid[];
  prix_base integer[];
  essences text[];
  longueurs integer[];
  skus text[];
  zones uuid[];
  distances numeric[];
  vehicules uuid[];

  jour date;
  decalage integer;
  saisonnalite numeric;
  nb_commandes integer;
  indice integer;
  graine integer := 0;

  id_commande uuid;
  id_variante uuid;
  position_variante integer;
  quantite numeric;
  prix_unitaire integer;
  sous_total integer;
  remise integer;
  livraison integer;
  total integer;
  position_zone integer;
  statut text;
  origine text;
  moyen text;
  compteur integer := 0;
  code_promo text;
  date_creation timestamptz;
  date_livraison timestamptz;
begin
  -- ---- Nettoyage de la démo précédente -----------------------------------
  delete from analytics_events
   where company_id = entreprise
     and session_id in (select id from analytics_sessions
                         where company_id = entreprise and campaign = 'demo');
  delete from analytics_sessions where company_id = entreprise and campaign = 'demo';
  delete from quote_requests where company_id = entreprise and reference like 'DEMO-%';
  -- order_items, order_status_history et payments partent en cascade.
  delete from orders where company_id = entreprise and reference like 'DEMO-%';

  -- ---- Référentiel réellement présent en base ----------------------------
  select array_agg(v.id order by v.sku),
         array_agg(v.base_price_cents order by v.sku),
         array_agg(coalesce(p.name, 'Bois') order by v.sku),
         array_agg(coalesce(cl.cm, 33) order by v.sku),
         array_agg(v.sku order by v.sku)
    into variantes, prix_base, essences, longueurs, skus
    from product_variants v
    join products p on p.id = v.product_id
    left join cut_lengths cl on cl.id = v.cut_length_id
   where v.company_id = entreprise and v.is_active;

  select array_agg(id order by name) into zones
    from delivery_zones where company_id = entreprise;

  select array_agg(id order by fuel_consumption_l_per_100km) into vehicules
    from vehicles where company_id = entreprise;

  distances := array[8, 22, 37, 52]::numeric[];

  if variantes is null or zones is null or vehicules is null then
    raise exception 'Référentiel incomplet : lancez d''abord `npm run db:reset`.';
  end if;

  -- ---- 14 mois d'historique ----------------------------------------------
  for decalage in reverse 425 .. 0 loop
    jour := aujourd_hui - decalage;

    -- Saison de chauffe : le pic est en novembre-décembre, le creux en juillet.
    -- Sinusoïde calée sur le mois, jamais nulle — on vend un peu toute l'année.
    saisonnalite := 0.30 + 0.70 * (0.5 + 0.5 * cos(2 * pi() * (extract(doy from jour) - 340) / 365.0));

    -- Pseudo-aléa déterministe : deux exécutions donnent le même jeu, ce qui
    -- rend les captures d'écran comparables d'une session à l'autre.
    graine := (decalage * 7919 + 104729) % 1000;

    nb_commandes := floor(saisonnalite * 3.4 + (graine % 100) / 55.0)::integer;
    -- Le dimanche, on ne prend presque rien.
    if extract(isodow from jour) = 7 then
      nb_commandes := least(nb_commandes, 1);
    end if;

    for indice in 1 .. nb_commandes loop
      compteur := compteur + 1;
      graine := (graine * 31 + indice * 137 + 17) % 1000;

      position_variante := 1 + (graine % array_length(variantes, 1));
      id_variante := variantes[position_variante];
      prix_unitaire := prix_base[position_variante];
      quantite := (array[1, 2, 2, 3, 4, 5, 6, 8])[1 + (graine % 8)];

      position_zone := 1 + ((graine / 7) % array_length(zones, 1));

      sous_total := (prix_unitaire * quantite)::integer;
      code_promo := case when graine % 23 = 0 then 'HIVER10' else null end;
      remise := case when code_promo is null then 0 else (sous_total * 0.10)::integer end;
      livraison := (1500 + distances[position_zone] * 45)::integer;
      total := sous_total - remise + livraison;

      -- Le statut dépend de l'ancienneté : le passé est livré, le présent est
      -- en cours. Un tableau de bord où tout est « livré » ne se teste pas.
      statut := case
        when graine % 37 = 0 then 'annulee'
        when decalage > 20 then 'livree'
        when decalage > 8 then 'planifiee'
        when decalage > 3 then 'a_preparer'
        else 'nouvelle'
      end;
      origine := case when graine % 10 < 6 then 'web' when graine % 10 < 9 then 'phone' else 'admin' end;
      moyen := (array['card', 'cash', 'transfer', 'check'])[1 + (graine % 4)];

      date_creation := (jour + time '08:00') at time zone 'utc'
                       + make_interval(mins => (graine % 600));
      id_commande := gen_random_uuid();

      insert into orders (
        id, company_id, reference, is_guest, status, email, phone,
        first_name, last_name, fulfillment_type, shipping_address, zone_id,
        distance_km, vehicle_id, confirmed_delivery_date,
        subtotal_cents, discount_cents, delivery_base_cents, delivery_total_cents,
        total_cents, total_volume_m3, payment_method, payment_status,
        amount_paid_cents, promotion_code, fuel_price_snapshot_cents,
        source, acquisition_source, quote_pdf_before_order, created_at, updated_at
      ) values (
        id_commande, entreprise, 'DEMO-' || lpad(compteur::text, 5, '0'), true, statut,
        'client' || (compteur % 60) || '@demo.test',
        '06' || lpad(((graine * 7) % 100000000)::text, 8, '0'),
        (array['Jean', 'Marie', 'Paul', 'Sophie', 'Luc', 'Claire', 'André', 'Hélène'])[1 + (graine % 8)],
        (array['Rivière', 'Bonnet', 'Faure', 'Marchand', 'Ollier', 'Dumas', 'Chabert', 'Vialle'])[1 + ((graine / 3) % 8)],
        'delivery',
        jsonb_build_object(
          'city', (array['Annonay', 'Davézieux', 'Boulieu-lès-Annonay', 'Sarras', 'Serrières'])[1 + (graine % 5)],
          'postalCode', (array['07100', '07430', '07100', '07370', '07340'])[1 + (graine % 5)]
        ),
        zones[position_zone], distances[position_zone],
        vehicules[1 + (graine % array_length(vehicules, 1))],
        case when statut in ('livree', 'planifiee') then jour + 3 else null end,
        sous_total, remise, livraison, livraison, total, quantite,
        moyen,
        case when statut = 'livree' then 'paid' when statut = 'annulee' then 'pending' else 'pending' end,
        case when statut = 'livree' then total else 0 end,
        code_promo, 189,
        origine,
        case when graine % 5 = 0 then 'seo' else null end,
        graine % 11 = 0,
        date_creation, date_creation
      );

      insert into order_items (
        company_id, order_id, variant_id, product_name, variant_label, sku,
        species_label, cut_length_cm, quantity, unit, unit_volume_m3,
        line_volume_m3, unit_price_cents, line_total_cents, vat_rate
      ) values (
        entreprise, id_commande, id_variante, essences[position_variante],
        longueurs[position_variante] || ' cm', skus[position_variante],
        essences[position_variante], longueurs[position_variante],
        quantite, 'm3app', 1, quantite, prix_unitaire, sous_total, 10.00
      );

      if statut = 'livree' then
        date_livraison := date_creation + make_interval(days => 2 + (graine % 6));
        insert into order_status_history (company_id, order_id, from_status, to_status, actor, created_at)
        values (entreprise, id_commande, 'planifiee', 'livree', 'driver', date_livraison);

        insert into payments (company_id, order_id, method, amount_cents, status, received_at, created_at)
        values (entreprise, id_commande, moyen, total,
                case when graine % 53 = 0 then 'refunded' else 'succeeded' end,
                date_livraison, date_livraison);
      end if;
    end loop;
  end loop;

  raise notice 'Commandes de démonstration créées : %', compteur;
end $$;

-- ---- Demandes de devis ------------------------------------------------------
insert into quote_requests (
  company_id, reference, status, first_name, last_name, email, phone,
  postal_code, city, species, cut_length_cm, quantity_m3, message,
  estimated_total_cents, responded_at, created_at
)
select
  '11111111-1111-1111-1111-111111111111',
  'DEMO-D' || lpad(n::text, 4, '0'),
  (array['nouveau', 'envoye', 'accepte', 'accepte', 'refuse'])[1 + (n % 5)],
  'Demande', 'n°' || n,
  'devis' || n || '@demo.test',
  '0475' || lpad((n * 137 % 1000000)::text, 6, '0'),
  '07100', 'Annonay',
  (array['Chêne', 'Chêne / Hêtre', 'Mix bois durs'])[1 + (n % 3)],
  (array[25, 33, 50])[1 + (n % 3)],
  8 + (n % 20),
  'Livraison difficile, chemin étroit.',
  (8 + (n % 20)) * 10400,
  case when n % 5 = 0 then null
       else (now() at time zone 'utc') - make_interval(days => 120 - n, hours => 6 + (n % 40)) end,
  (now() at time zone 'utc') - make_interval(days => 120 - n)
from generate_series(1, 110) as n;

-- ---- Parcours mesuré : tunnel et demande perdue -----------------------------
-- Une session par visite, des événements par étape. Les volumes décroissent
-- d'une étape à l'autre — c'est ce que le tunnel doit montrer.
-- Le rang est porté par `landing_path` : `RETURNING` n'accepte pas de fonction
-- de fenêtrage, et une numérotation a posteriori ne serait pas déterministe.
with sessions as (
  insert into analytics_sessions (company_id, acquisition_source, landing_path, campaign, started_at, last_seen_at)
  select
    '11111111-1111-1111-1111-111111111111',
    (array['seo', 'direct', 'seo', 'referral'])[1 + (n % 4)],
    '/?n=' || n, 'demo',
    (now() at time zone 'utc') - make_interval(days => (n % 120), mins => (n * 7) % 600),
    (now() at time zone 'utc') - make_interval(days => (n % 120), mins => ((n * 7) % 600) - 12)
  from generate_series(1, 2400) as n
  returning id, started_at, split_part(landing_path, '=', 2)::integer as rang
)
insert into analytics_events (company_id, session_id, event_type, reason, potential_revenue_cents, potential_volume_m3, occurred_at)
select
  '11111111-1111-1111-1111-111111111111',
  s.id,
  etape.type,
  case when etape.type = 'lost_demand'
       then (array['out_of_zone', 'unknown_postal_code', 'out_of_stock', 'no_slot', 'payment_failed'])[1 + (s.rang % 5)] end,
  case when etape.type = 'lost_demand' then 30000 + (s.rang % 9) * 10400 end,
  case when etape.type = 'lost_demand' then 3 + (s.rang % 9) end,
  s.started_at + make_interval(mins => etape.minute)
from sessions s
cross join lateral (
  values
    ('visit',       0, 1000),
    ('cart',        2,  430),
    ('zone_check',  4,  360),
    ('slot',        7,  210),
    ('payment',     9,  140),
    ('order',      12,   95),
    ('quote_pdf',   6,   80),
    ('lost_demand', 8,   60)
) as etape(type, minute, seuil)
-- Le rang décide qui va jusqu'où : on obtient un entonnoir, pas du bruit.
where (s.rang % 1000) < etape.seuil;

commit;
