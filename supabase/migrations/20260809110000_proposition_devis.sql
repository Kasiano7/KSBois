-- =============================================================================
-- Proposition commerciale attachée à une demande de devis
--
-- La demande dit ce que le client VEUT ; la proposition dit ce que l'entreprise
-- PROPOSE. Les deux doivent coexister : on ne réécrit jamais la demande d'un
-- client, sinon on perd la trace de ce qu'il avait réellement formulé.
--
-- ⚠️ Aucun montant de ligne n'est stocké ici : `proposal_lines` ne contient que
-- des identifiants de variante et des quantités. Les prix sont RECALCULÉS à
-- chaque lecture par le moteur de prix, comme pour le panier (PLAN.md §5.1).
-- Seuls sont stockés les montants DÉCIDÉS par l'exploitant : la remise et, quand
-- la commune n'est pas desservie, le prix de livraison qu'il fixe lui-même.
-- =============================================================================

alter table quote_requests
  -- [{ "variantId": "...", "quantity": 3 }]
  add column proposal_lines jsonb not null default '[]'::jsonb,
  add column delivery_included boolean not null default true,
  -- null = calculé automatiquement par le moteur de livraison quand la commune
  -- est desservie. Renseigné à la main dans le cas contraire — qui est
  -- précisément celui qui produit le plus de demandes de devis (hors zone).
  add column delivery_cents integer check (delivery_cents is null or delivery_cents >= 0),
  add column discount_cents integer not null default 0 check (discount_cents >= 0),
  add column discount_label text,
  add column valid_until date,
  -- Trace de la conversion : évite qu'un devis accepté produise deux commandes.
  add column converted_order_id uuid references orders(id) on delete set null;

comment on column quote_requests.proposal_lines is
  'Lignes proposées : uniquement variantId + quantity. Les prix sont recalculés côté serveur.';
comment on column quote_requests.delivery_cents is
  'Livraison fixée à la main. NULL = calcul automatique (commune desservie).';

create index quote_requests_converted_idx
  on quote_requests (converted_order_id)
  where converted_order_id is not null;
