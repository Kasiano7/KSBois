-- =============================================================================
-- Secteur de livraison automatique — docs/02-MOTEURS-METIER.md §2.1
--
-- Jusqu'ici `zone_communes` se remplissait à la main, une commune à la fois.
-- Deux conséquences : c'est long, et surtout c'est INCOMPLET — une commune
-- oubliée est un client qui voit « nous ne livrons pas chez vous » alors que le
-- camion passe devant sa maison. On alimente désormais la table depuis la base
-- officielle des communes (geo.api.gouv.fr), filtrée sur un rayon ROUTIER
-- autour du dépôt.
-- =============================================================================

alter table companies
  -- Rayon de service exprimé en kilomètres de route (pas à vol d'oiseau : en
  -- Ardèche, 20 km à vol d'oiseau peuvent faire 45 km de lacets).
  add column service_radius_km integer not null default 25
    check (service_radius_km between 1 and 200),
  add column sector_scanned_at timestamptz;

alter table zone_communes
  -- Coordonnées du chef-lieu : elles évitent de réinterroger l'API pour
  -- recalculer une distance quand le dépôt déménage ou que le rayon change.
  add column centre_lat numeric(9,6),
  add column centre_lng numeric(9,6),
  add column population integer,
  -- ⚠️ D'où vient `distance_km` ? C'est ce qui décide si on a le droit de
  -- l'écraser lors d'un nouveau scan. Une distance saisie par l'exploitant
  -- (« en réalité je passe par le col, c'est 34 km ») fait toujours foi.
  add column distance_source text not null default 'manuelle'
    check (distance_source in ('manuelle', 'route', 'vol_oiseau')),
  add column imported_at timestamptz;

-- Le code INSEE identifie une commune sans ambiguïté, là où (code postal, nom)
-- souffre des fusions de communes et des variantes d'orthographe.
create index zone_communes_insee_idx on zone_communes (company_id, insee_code);

-- -----------------------------------------------------------------------------
-- Import d'un lot de communes, en une seule transaction.
--
-- Écrit en SQL et non en TypeScript pour deux raisons : c'est atomique (un scan
-- à moitié importé laisserait une grille tarifaire incohérente), et les règles
-- de non-écrasement ci-dessous sont exprimables en une clause `on conflict`.
--
-- ⚠️ RÈGLE CENTRALE : un import n'écrase JAMAIS une décision humaine.
--   • une distance saisie à la main est conservée ;
--   • le rattachement à une zone est conservé ;
--   • une commune volontairement marquée « non desservie » le reste.
-- Sans cette règle, relancer un scan après six mois de réglages fins remettrait
-- la grille à zéro — et l'exploitant ne relancerait plus jamais de scan.
-- -----------------------------------------------------------------------------
create or replace function import_sector_communes(
  p_company_id uuid,
  p_communes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserees integer := 0;
  v_maj integer := 0;
begin
  if p_communes is null or jsonb_typeof(p_communes) <> 'array' then
    raise exception 'Liste de communes invalide';
  end if;

  with entrees as (
    -- `distinct on` : deux entrées identiques dans le même lot feraient échouer
    -- le `on conflict` (« cannot affect row a second time »).
    select distinct on (postal_code, city) *
    from (
      select
        nullif(c ->> 'insee_code', '')                as insee_code,
        (c ->> 'postal_code')                         as postal_code,
        (c ->> 'city')                                as city,
        nullif(c ->> 'distance_km', '')::numeric      as distance_km,
        coalesce(nullif(c ->> 'distance_source', ''), 'route') as distance_source,
        nullif(c ->> 'centre_lat', '')::numeric       as centre_lat,
        nullif(c ->> 'centre_lng', '')::numeric       as centre_lng,
        nullif(c ->> 'population', '')::integer       as population,
        nullif(c ->> 'zone_id', '')::uuid             as zone_id
      from jsonb_array_elements(p_communes) as c
    ) brut
    where postal_code ~ '^[0-9]{5}$' and city <> ''
  ),
  fusion as (
    insert into zone_communes as zc (
      company_id, zone_id, postal_code, city, insee_code, distance_km,
      distance_source, centre_lat, centre_lng, population, is_served, imported_at
    )
    select
      p_company_id, e.zone_id, e.postal_code, e.city, e.insee_code, e.distance_km,
      e.distance_source, e.centre_lat, e.centre_lng, e.population,
      e.zone_id is not null, now()
    from entrees e
    on conflict (company_id, postal_code, city) do update set
      insee_code = coalesce(excluded.insee_code, zc.insee_code),
      centre_lat = coalesce(excluded.centre_lat, zc.centre_lat),
      centre_lng = coalesce(excluded.centre_lng, zc.centre_lng),
      population = coalesce(excluded.population, zc.population),
      distance_km = case
        when zc.distance_source = 'manuelle' and zc.distance_km is not null
          then zc.distance_km
        else coalesce(excluded.distance_km, zc.distance_km)
      end,
      distance_source = case
        when zc.distance_source = 'manuelle' and zc.distance_km is not null
          then zc.distance_source
        else excluded.distance_source
      end,
      -- Le rattachement et la desserte restent la décision de l'exploitant.
      zone_id = coalesce(zc.zone_id, excluded.zone_id),
      is_served = zc.is_served or (zc.zone_id is null and excluded.zone_id is not null),
      imported_at = now()
    -- `xmax = 0` distingue une insertion d'une mise à jour : c'est ce qui permet
    -- d'annoncer « 42 ajoutées, 8 mises à jour » plutôt qu'un « 50 traitées »
    -- inexploitable.
    returning (xmax = 0) as insertion
  )
  select
    count(*) filter (where insertion),
    count(*) filter (where not insertion)
  into v_inserees, v_maj
  from fusion;

  update companies set sector_scanned_at = now() where id = p_company_id;

  return jsonb_build_object('inserees', v_inserees, 'mises_a_jour', v_maj);
end;
$$;

revoke all on function import_sector_communes(uuid, jsonb) from public, anon, authenticated;
grant execute on function import_sector_communes(uuid, jsonb) to service_role;

-- Les communes déjà saisies à la main gardent leur distance : elle a été
-- mesurée par l'exploitant, elle vaut mieux qu'un calcul d'API.
comment on column zone_communes.distance_source is
  'manuelle = saisie par l''exploitant (jamais écrasée), route = mesurée par le routeur, vol_oiseau = estimation de repli';
