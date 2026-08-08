-- =============================================================================
-- 0006 — Brouillon de commande porté par le panier
--
-- Le tunnel comporte 4 étapes (panier → coordonnées → créneau → paiement).
-- Les données saisies entre deux étapes doivent survivre à un rechargement,
-- à une fermeture d'onglet et à un changement d'appareil pour un client
-- connecté. Elles vivent donc sur le panier, pas dans un cookie de session.
--
-- Ces colonnes ne sont PAS une duplication de `orders` : le panier est un
-- brouillon modifiable, la commande est un instantané figé (docs/01 §3.7).
-- =============================================================================

alter table carts
  -- Contact
  add column email citext,
  add column phone text,
  add column first_name text,
  add column last_name text,
  -- Mode de récupération
  add column fulfillment_type text not null default 'delivery'
    check (fulfillment_type in ('delivery','pickup')),
  -- Adresse de livraison
  add column address_line1 text,
  add column address_line2 text,
  -- Contraintes d'accès : le champ qui évite 90 % des livraisons ratées
  add column access_notes text,
  add column truck_access text not null default 'camion'
    check (truck_access in ('spl','camion','fourgon','remorque_seule')),
  add column unload_type text check (unload_type in ('vrac_sol','range','benne')),
  add column allow_unattended_delivery boolean not null default false,
  -- Créneau souhaité (jamais une promesse ferme : l'entreprise confirme)
  add column slot_id uuid references delivery_slots(id) on delete set null,
  add column delivery_notes text,
  -- Étape atteinte, pour reprendre le tunnel où il s'est arrêté
  add column step text not null default 'panier'
    check (step in ('panier','coordonnees','creneau','paiement'));

-- Le panier reste strictement serveur : aucun privilège ajouté.
-- (cf. supabase/migrations/…_grants.sql — carts et cart_items sont révoqués
--  pour anon et authenticated.)
