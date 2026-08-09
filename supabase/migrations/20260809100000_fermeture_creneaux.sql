-- =============================================================================
-- Traçabilité de la fermeture d'un créneau par une période bloquée
--
-- « Bloquer une période » (congés, intempéries) doit fermer les créneaux DÉJÀ
-- générés sur la période : sans cela, la fermeture ne produit aucun effet sur
-- les 45 jours déjà en base, et le site continue de proposer des livraisons
-- pendant les vacances de l'exploitant.
--
-- Le lien inverse est indispensable : sans lui, supprimer les congés laisserait
-- les créneaux fermés à vie, et il faudrait rouvrir chaque demi-journée à la
-- main. On ne rouvre que ce que CETTE fermeture a fermé — jamais un créneau
-- fermé volontairement pour une autre raison.
-- =============================================================================

alter table delivery_slots
  add column closed_by_blackout_id uuid references slot_blackouts(id) on delete set null;

comment on column delivery_slots.closed_by_blackout_id is
  'Fermeture automatique due à une période bloquée. Renseigné par bloquerPeriode(), effacé à la réouverture.';

create index delivery_slots_blackout_idx
  on delivery_slots (closed_by_blackout_id)
  where closed_by_blackout_id is not null;
