-- =============================================================================
-- 0008 — Relevés de carburant refusés
--
-- Le contrôle de sanité refuse un relevé dont l'écart dépasse 15 % : c'est plus
-- souvent un bug de source qu'un vrai mouvement de marché. Mais un relevé refusé
-- doit rester VISIBLE, sinon deux situations deviennent indétectables :
--   • une hausse réelle et durable, que le garde-fou bloquerait indéfiniment ;
--   • une source défaillante, dont personne ne verrait les échecs répétés.
--
-- On conserve donc tous les relevés, en distinguant ceux qui font foi.
-- =============================================================================

alter table fuel_prices
  add column applied boolean not null default true,
  add column rejected_reason text;

comment on column fuel_prices.applied is
  'Faux si le relevé a été refusé par le contrôle de sanité : il est conservé pour information mais ne sert pas au calcul des frais.';

-- Les calculs ne lisent que les relevés appliqués.
create index fuel_prices_appliques_idx
  on fuel_prices (company_id, applied, recorded_at desc);
