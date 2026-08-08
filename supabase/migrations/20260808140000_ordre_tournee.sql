-- =============================================================================
-- 0007 — Ordre de passage dans la tournée
--
-- L'exploitant réordonne ses arrêts par glisser-déposer : il connaît des
-- contraintes qu'aucun algorithme ne devine (client absent avant 10 h, route en
-- travaux, chien méchant). Cet ordre doit être persisté.
-- =============================================================================

alter table orders
  add column route_position integer;

comment on column orders.route_position is
  'Position dans la tournée du jour, 1 = premier arrêt. Null = non ordonnée.';

-- La feuille de tournée se lit toujours par date puis par position.
create index orders_tournee_idx
  on orders (company_id, confirmed_delivery_date, route_position);
