# 02 — Moteurs métier

> Tout le code de cette section vit dans `src/domain/`. **Zéro I/O, zéro dépendance framework, 100 % couvert par des tests unitaires.** C'est le patrimoine réutilisable du projet.

---

## 1. Moteur de prix

### 1.0 Options de service

Le rangement est une option TTC calculée côté serveur : `prix_par_m3_cents × volume_m3_apparent`,
avec un seul arrondi final. Le prix par défaut est **20 €/m³**, lu dans `product_options` et
modifiable dans les réglages. L'option porte son propre taux de TVA à **20 %** ; le moteur de
ventilation inclut donc les options détaillées, et pas seulement un total sans taux. Le navigateur
n'envoie ni le prix ni le montant calculé, uniquement le choix `unload_type = 'range'`.

### 1.1 Calcul d'une ligne

```
entrée : variant, quantity
1. Valider quantity : >= min_quantity, <= max_quantity, multiple de quantity_step
2. Résoudre le palier : le price_tier avec le plus grand min_quantity <= quantity
   → si aucun palier ne correspond, utiliser variant.base_price_cents
3. unit_price_cents = prix du palier résolu
4. line_total_cents = round(unit_price_cents × quantity)
5. line_volume_m3   = quantity × variant.unit_volume_m3
```

**Règle d'arrondi :** `Math.round()` sur le centime, appliqué **une seule fois** en fin de ligne. Jamais d'arrondi intermédiaire.

### 1.2 Totaux de commande

```
subtotal      = Σ line_total_cents
options       = Σ option.price_cents  (ou price_per_m3 × volume_total)
discount      = résolution promotion (voir §6)
delivery      = moteur de livraison (§2)
total         = subtotal + options - discount + delivery
```

**Ordre imposé :** la remise s'applique **avant** les frais de livraison, sauf pour une promotion `free_delivery` qui annule `delivery` après calcul (pour conserver la traçabilité du montant offert).

### 1.3 Ventilation TVA

Les prix affichés sont **TTC**. La TVA est reconstituée par taux :

```
pour chaque taux distinct présent dans la commande :
  base_ttc = Σ des lignes à ce taux (frais de port inclus, ventilés au prorata du TTC des lignes)
  base_ht  = round(base_ttc / (1 + rate/100))
  vat      = base_ttc - base_ht
```

En mode `franchise_en_base`, `vat_breakdown` reste vide et les documents portent la mention légale (`PLAN.md` §3.6).

### 1.4 Affichage des unités

Une fonction unique `formatVolume(m3, cutLengthCm)` produit toujours la même chaîne dans tout le site :

> **3 m³ apparents** · ≈ 3 stères · bûches de 33 cm

Elle est utilisée sur la fiche produit, le panier, le devis, la facture, le bon de livraison et les emails. **Aucune concaténation manuelle d'unité ailleurs dans le code.**

---

## 2. Moteur de livraison

C'est le composant le plus différenciant du produit. Il répond à trois questions : *est-ce que je livre ?*, *quand ?*, *combien ça coûte ?*

### 2.1 Résolution de zone

```
entrée : postal_code, city (ou insee_code)
1. Chercher dans zone_communes (company_id, postal_code, city)
   → correspondance sur le nom normalisé (sans accent, casse ni ponctuation)
   → trouvée : on répond ici, sans aucun appel réseau (cas le plus fréquent)
2. Sinon, interroger la BASE OFFICIELLE pour ce code postal (geo.api.gouv.fr)
   → union { communes de la liste } ∪ { communes réelles du code postal }
3. Plusieurs communes → demander laquelle, en les proposant TOUTES
4. Commune identifiée mais hors liste ou is_served = false :
   → { not_served, commune } → bascule vers le parcours DEVIS (§7)
5. Aucune commune nommable :
   → { unknown, raison: inexistant | source_indisponible }
6. Sinon retour { zone, distance_km, delivery_days }
```

**La liste de l'exploitant ne fait pas autorité sur la géographie française.** Un code postal absent de sa liste reste un code postal réel : le site doit pouvoir écrire « nous ne livrons pas encore **Peaugres** — demandez un devis » plutôt que « code postal inconnu ». La première phrase amène une demande de devis, la seconde se lit comme un bug et le visiteur s'en va.

Conséquence directe sur la levée d'ambiguïté : 07340 couvre **seize** communes réelles. N'en proposer que les deux que l'on connaît obligerait un habitant de Peaugres à se déclarer à Serrières — et à recevoir la distance, donc le tarif, de Serrières.

`raison` n'est pas un détail de journalisation : annoncer « ce code postal n'existe pas » alors que c'est notre source qui est muette fait douter le client de sa propre adresse. Source injoignable → on le dit et on propose un devis ; code postal réellement inexistant → on invite à corriger la saisie, sans proposer de devis.

**Point UX critique :** ce contrôle intervient **dès le panier**, pas au paiement. Un client qui découvre au moment de payer qu'on ne le livre pas est un client perdu et énervé. Le panier affiche un champ « Votre code postal » et calcule les frais en direct.

**Alimentation de `zone_communes` — scan par rayon.** L'exploitant décrit son métier (« je pars de Villevocance, je livre à 25 km ») et le système déduit la liste. La saisie manuelle reste possible, mais elle n'est plus le mode normal : une liste tenue à la main est longue à établir et surtout **incomplète**, et une commune oubliée est un client qui lit « nous ne livrons pas chez vous » alors que le camion passe devant sa porte.

```
entrée : dépôt (companies.depot_lat/lng), rayon en km de ROUTE
1. Départements candidats — table statique (centre + rayon de couverture)
   → interroger la France entière coûterait 4,8 Mo et ~25 s
2. geo.api.gouv.fr/communes?codeDepartement=… (nom, INSEE, codes postaux, centre)
3. Pré-filtre à vol d'oiseau au rayon demandé
   → filtre EXACT : une route n'est jamais plus courte que le vol d'oiseau
4. Distances routières réelles — OSRM, service `table`, par lots de 90
   → en échec : vol d'oiseau × 1,3, marqué `vol_oiseau` et signalé à l'écran
5. Écarter les communes au-delà du rayon PAR LA ROUTE, et les compter
6. Suggérer une zone : couronne dont la distance indicative est la plus proche
   → au-delà de la dernière couronne : aucune zone (l'exploitant tranche)
7. Restitution à l'écran — AUCUNE écriture
8. Import explicite → import_sector_communes(company_id, jsonb)
```

**Une commune = une ligne par code postal.** Beaucoup de communes en portent plusieurs ; n'en retenir qu'un est exactement ce qui fait échouer la résolution de zone pour la moitié des habitants (constaté sur 07690 / 07100 / 07340 d'une liste saisie à la main).

**Garde-fous de l'import** (fonction SQL, donc atomique) :

- une `distance_km` saisie à la main n'est **jamais** écrasée — `distance_source` en garde la trace ;
- le rattachement à une zone et les communes fermées sont préservés ;
- les valeurs venues du navigateur sont recoupées avec la base officielle avant écriture, et la distance est bornée par la géométrie : elle alimente la surcharge carburant, donc une facture (§2.3).

L'admin voit ensuite une liste triable « Commune → Zone → Distance → Jours » et affecte les communes en masse. C'est l'écran d'administration le plus important à soigner.

### 2.2 Sélection du véhicule

```
entrée : total_volume_m3, address.truck_access
1. Filtrer vehicles : is_active, capacity_m3 >= volume, type compatible avec truck_access
2. Trier par capacity_m3 croissante → prendre le premier (le plus petit qui convient)
3. Si aucun véhicule ne convient (volume > plus grande capacité) :
   → proposer un fractionnement en plusieurs livraisons, ou basculer en devis
```

Le champ `address.truck_access` (renseigné par le client : « un semi peut-il accéder ? ») **exclut** les véhicules trop gros. C'est ce qui évite le camion qui fait demi-tour dans un chemin de montagne ardéchois.

### 2.3 Formule tarifaire

```
frais_bruts = zone.base_fee_cents
            + zone.fee_per_m3_cents × volume_m3
            + surcharge_carburant

surcharge_carburant =
    distance_km × 2                              (aller-retour)
  × vehicle.fuel_consumption_l_per_100km / 100   (litres au km)
  × fuel_price_per_liter_cents                   (prix du jour)
  × fuel_margin_coefficient                      (défaut 1.0, configurable)
  + distance_km × 2 × vehicle.cost_per_km_cents  (usure, optionnel)

frais_finaux = arrondi_superieur(frais_bruts, rounding_step_cents)  # défaut 50 c
si subtotal >= zone.free_above_cents        → frais_finaux = 0
si promotion.type = 'free_delivery'         → frais_finaux = 0
```

**Garde-fous obligatoires** (sinon un bug d'API carburant peut facturer 900 € de port) :

- `fuel_surcharge` est plafonnée à `max_fuel_surcharge_cents` (défaut : 40 % des frais de base).
- Si aucun prix carburant n'est disponible depuis plus de 7 jours, on utilise `fallback_fuel_price_cents` et on log un avertissement.
- Le total des frais est borné par `delivery_fee_max_cents` (défaut 150 €) ; au-delà → bascule devis.
- La feature `fuel_surcharge` peut être coupée entièrement : la formule redevient `base + coef × m³`.

### 2.4 Prix du carburant — récupération automatique

**Source : open data officiel français**, `data.economie.gouv.fr`, jeu de données *prix des carburants en France — flux instantané*. C'est gratuit, officiel, sans clé API, et bien plus fiable qu'un scraping du site Total qui casserait au premier changement de DOM.

```
Cron : tous les jours à 10h00 Europe/Paris  →  /api/cron/fuel-price
1. Requête filtrée sur le département du dépôt (07) et carburant = Gazole
2. Extraire les prix, écarter les valeurs aberrantes (hors [P25 - 1.5×IQR, P75 + 1.5×IQR])
3. Calculer la MÉDIANE (pas la moyenne — robuste aux stations aberrantes)
4. Contrôle de sanité : variation > 15 % vs la dernière valeur → ne pas appliquer, alerter l'admin
5. INSERT dans fuel_prices
6. revalidateTag('delivery-pricing')
```

**Écran admin `/admin/livraison/carburant` :**
- Prix du jour + graphique 90 jours
- Bouton « Figer le prix » (mode manuel) avec saisie
- Coefficient de marge carburant
- Simulateur : *« Livraison de 5 m³ à 32 km en camion → 21,50 € dont 6,80 € de carburant »*

Ce simulateur est indispensable : l'exploitant doit **comprendre** le calcul, sinon il ne fera pas confiance au site.

### 2.5 Contraintes de zone

Avant de proposer un créneau, le moteur vérifie :

| Contrainte | Effet si non respectée |
|---|---|
| `zone.min_order_amount_cents` | Message : « Commande minimum de X € pour votre commune » + montant manquant |
| `zone.min_order_volume_m3` | Message : « Minimum X m³ pour votre commune » |
| `zone.delivery_days` / `commune.delivery_days` | Filtre les créneaux proposés |
| `zone.lead_time_days` | Décale la première date disponible |
| Volume > capacité max véhicule | Propose un fractionnement ou un devis |

Les messages sont **constructifs**, jamais bloquants secs : on indique toujours ce qu'il manque et un bouton d'action (« Ajouter 1 m³ », « Demander un devis »).

---

## 3. Moteur de créneaux

### 3.1 Modèle en deux temps — décision structurante

Le client choisit un **créneau souhaité**, l'entreprise **confirme**. Le site ne promet jamais une heure ferme à la place du bûcheron.

```
Commande passée   → slot réservé (capacité décrémentée), statut "planifiée" NON atteint
Admin confirme    → confirmed_delivery_date + confirmed_slot_label renseignés
                  → statut "planifiée" → email/SMS "Votre livraison est confirmée mardi matin"
Veille à 18h      → SMS de rappel (cron)
```

Le libellé côté client est explicite : **« Créneau souhaité »**, avec la mention *« Nous vous confirmons la date par email sous 24 h. »* Cette honnêteté vaut mieux qu'une fausse promesse.

### 3.2 Génération et disponibilité

```
Cron hebdomadaire → generate_slots(horizon = booking_horizon_days, défaut 45)
  pour chaque slot_template actif, pour chaque date dans l'horizon :
    si weekday correspond ET aucun blackout ne couvre la date :
      INSERT delivery_slots (idempotent via la contrainte unique)
```

**Implémenté** : fonction Postgres `generate_delivery_slots(company_id, horizon_days)`, appelée par le cron `/api/cron/generate-slots` (lundi 4 h, horizon + 14 jours de marge pour couvrir l'intervalle entre deux passages) et par le bouton « Générer les dates » de `/admin/livraison/creneaux`.

⚠️ **Panne silencieuse à connaître.** La génération est ponctuelle, l'horizon recule d'un jour par jour écoulé. Sans passage régulier, le tunnel de commande finit par ne proposer **aucune** date — sans erreur, sans log, sans alerte. C'est pourquoi l'écran créneaux affiche en permanence jusqu'à quelle date les clients peuvent réserver et alerte avant l'épuisement. Toute reprise de ce code doit conserver ce signal.

**Fermeture d'une période après génération.** Créer un `slot_blackout` empêche les générations futures mais ne touche pas aux dates déjà en base : `book_slot()` ne regarde que `is_open`. L'action d'administration ferme donc réellement les créneaux de la période et mémorise le lien (`delivery_slots.closed_by_blackout_id`) pour pouvoir les rouvrir — et eux seuls — si la fermeture est annulée.

```
Disponibilité d'un créneau pour une commande donnée :
  is_open = true
  ET date >= aujourd'hui + lead_time_days (zone ou global)
  ET date n'est pas dans un blackout couvrant la zone
  ET (slot.zone_ids vide OU zone de la commande ∈ slot.zone_ids)
  ET weekday ∈ delivery_days de la commune
  ET booked_deliveries < max_deliveries
  ET booked_volume_m3 + volume_commande <= max_volume_m3     ← la vraie contrainte
  ET (slot.vehicle = véhicule requis, si le créneau est lié à un véhicule)
```

**La double capacité est le point clé.** 8 livraisons de 2 m³ tiennent dans une matinée ; 8 livraisons de 10 m³ représentent trois jours de travail. Un créneau qui affiche « complet » alors qu'il ne reste qu'une place mais plus de volume est un créneau correctement modélisé.

### 3.3 Affichage client

- Vue **liste de dates**, pas un calendrier mensuel. Une audience 55+ sur mobile choisit mieux dans une liste verticale de 10 dates que dans une grille.
- Format : **« Mardi 14 octobre · Matin (8h–12h) »**, avec un badge « Il reste 2 places » quand la capacité restante ≤ 2 (urgence honnête, pas fabriquée).
- Les créneaux complets ne sont **pas affichés du tout** (pas de barré grisé qui frustre).
- Option **« Peu importe, contactez-moi »** toujours proposée en dernier — elle capte les indécis et crée une commande sans créneau que l'admin planifie manuellement.

### 3.4 Libération

Le créneau est libéré automatiquement lorsque : la commande est annulée, le paiement échoue et expire (30 min pour Stripe), ou l'admin déplace la commande. Toute libération passe par `release_slot()` et est tracée.

---

## 4. Moteur de stock

### 4.1 Modèle

```
stock_on_hand   : ce qui existe physiquement
stock_reserved  : engagé par des commandes non encore livrées
stock_available : on_hand - reserved   (colonne générée, jamais écrite)
```

### 4.2 Cycle de vie

| Événement | Effet |
|---|---|
| Commande validée (paiement OK ou mode différé confirmé) | `reserved += quantité` · mouvement `reservation` |
| Commande annulée | `reserved -= quantité` · mouvement `release` |
| Commande passée à `livree` | `on_hand -= quantité`, `reserved -= quantité` · mouvement `shipment` |
| Production (l'exploitant a fendu du bois) | `on_hand += quantité` · mouvement `production` |
| Correction d'inventaire | `on_hand = valeur saisie` · mouvement `adjustment` avec motif obligatoire |
| Perte, casse, reprise | mouvement `loss` |

**Jamais d'`UPDATE` direct sur `stock_on_hand` depuis le code applicatif.** Tout passe par `apply_stock_movement()` qui écrit le mouvement et met à jour le compteur dans la même transaction.

### 4.3 Affichage client

| État | Affichage |
|---|---|
| `available > low_threshold` | Rien (ne pas encombrer) |
| `0 < available <= low_threshold` | « Plus que X m³ disponibles » |
| `available <= 0` et `allow_backorder` | « Sur commande — livraison à partir du {backorder_available_at} » — **achetable** |
| `available <= 0` et pas de backorder | « Rupture de stock » — bouton désactivé + **champ « Prévenez-moi »** |
| `track_stock = false` | Aucun affichage de stock |

Le champ « Prévenez-moi quand c'est disponible » transforme une rupture en lead. Il alimente une table `stock_alerts` et déclenche un email au réapprovisionnement.

### 4.4 Alertes

- Cron quotidien : toute variante sous son seuil → email récapitulatif au patron.
- Badge rouge permanent dans la sidebar admin avec le nombre de variantes concernées.
- Écran `/admin/stock` : tableau éditable en ligne, une colonne « Ajouter de la production » avec saisie rapide (`+5`), sans passer par la fiche produit. L'exploitant doit pouvoir mettre à jour son stock en 20 secondes depuis son téléphone après une journée de fendage.

---

## 5. Machine à états des commandes

### 5.0 Commande préparée depuis l'administration

Depuis une fiche client, l'administration prépare un panier serveur vide et préremplit coordonnées,
adresse par défaut et contraintes d'accès. Un cookie `httpOnly` de quatre heures marque ce parcours,
mais il ne fait jamais foi seul : à la validation, une session `owner` ou `staff` du même tenant est
revérifiée. La commande reçoit alors `source = 'admin'` et `created_by`. Sans session valide, le
parcours retombe sur une commande web normale. Dans tous les cas, une fiche bloquée est refusée côté
serveur, y compris si le navigateur tente de contourner l'interface.

### 5.1 Transitions autorisées

```
                 ┌──────────────────────────────────────┐
                 ▼                                      │
  nouvelle ──► en_attente_paiement ──► payee ──► a_preparer ──► prete
      │                 │                │                        │
      │                 │                └────────────────────────┤
      │                 ▼                                         ▼
      └───────────► annulee ◄──────────────────────────────── planifiee
                        ▲                                         │
                        │                                         ▼
                        └───────────────────────────────────── livree
```

| Statut | Signification | Déclencheur |
|---|---|---|
| `nouvelle` | Créée, paiement non initié | Validation du tunnel |
| `en_attente_paiement` | Virement/chèque attendu, ou Stripe en cours | Choix du mode de paiement |
| `payee` | Encaissement confirmé | Webhook Stripe, ou saisie admin |
| `a_preparer` | Bon à fendre/charger | Automatique après `payee`, ou manuel si paiement à la livraison |
| `prete` | Chargée, prête à partir | Manuel |
| `planifiee` | Date confirmée au client | Admin confirme le créneau |
| `livree` | Livrée et encaissée | Admin ou livreur |
| `annulee` | Terminal | Admin, ou expiration de paiement |

**Règles :**
- Une commande en paiement à la livraison passe `nouvelle → a_preparer` directement (elle n'est jamais `payee` avant la livraison), et `payee` est enregistré au moment du passage à `livree`.
- Le passage à `livree` **exige** qu'un paiement couvre le total, sauf dérogation explicite (case « impayé » avec motif → crée une créance visible au dashboard).
- Chaque transition écrit dans `order_status_history` et peut déclencher une notification (configurable par statut dans les réglages).
- Les transitions non listées lèvent une erreur — la machine est implémentée comme une table de transitions dans `src/domain/orders/state-machine.ts`, pas comme des `if` dispersés.

### 5.2 Modification d'une commande par l'admin

Autorisée jusqu'à `livree`. Toute modification :
1. recalcule intégralement les totaux via le moteur de prix,
2. ajuste les réservations de stock et de créneau,
3. écrit un `audit_log` avec le diff avant/après,
4. propose (sans l'imposer) d'envoyer un email « Votre commande a été modifiée ».

Si le nouveau total est supérieur et que la commande est déjà payée par CB, l'admin voit un encart : *« Différence de +42 € — envoyer un lien de paiement complémentaire ? »*.

---

## 6. Paiements

### 6.1 Modes et disponibilité

Chaque mode est activable par entreprise et **filtré dynamiquement** selon le contexte de la commande :

| Mode | Condition d'affichage | Flux |
|---|---|---|
| `card` (Stripe) | Toujours si activé | Payment Intent → `payee` sur webhook `payment_intent.succeeded` |
| `cash` | `total <= cash_limit_cents` (1 000 €) **et** livraison (pas retrait sans présence) | `a_preparer` direct ; paiement saisi à la livraison |
| `check` | Si activé | `en_attente_paiement` ; l'admin saisit le n° de chèque à réception |
| `transfer` | Si activé | `en_attente_paiement` ; RIB affiché + rappelé par email avec la référence de commande en libellé |
| `sumup` | Livraison uniquement | Encaissement hors ligne au camion, saisi par le livreur dans l'app mobile |
| `deposit` (acompte) | Si `volume >= trigger_volume` **ou** `distance >= trigger_km` | Acompte CB en ligne → `deposit_paid` ; solde à la livraison |

**Le filtrage est calculé côté serveur** et renvoyé au tunnel. Le client ne voit jamais un mode qu'il ne peut pas utiliser. Le message accompagnant l'absence d'espèces est explicite : *« Le paiement en espèces est limité à 1 000 € par la réglementation. »*

### 6.2 Flux Stripe

```
1. Server Action  : recalcule le total, crée l'Order (statut nouvelle),
                    réserve stock + créneau, crée le PaymentIntent
                    metadata: { order_id, company_id }
2. Client         : Stripe Elements (paiement intégré au site, pas de redirection)
3. Webhook        : vérification de signature OBLIGATOIRE
   - payment_intent.succeeded  → payments.status = succeeded, order → payee → a_preparer
   - payment_intent.failed     → libère stock + créneau, order → annulee (après délai)
4. Idempotence    : contrainte unique sur stripe_payment_intent_id +
                    table processed_webhook_events (event.id) pour ignorer les rejeux
```

**Ne jamais** faire confiance au retour navigateur pour marquer une commande payée. Seul le webhook fait foi.

### 6.3 Acompte

```
deposit_cents = round(total_cents × deposit_percent / 100)
Paiement 1 (CB, en ligne)   → payments.kind = 'deposit' → order.payment_status = 'deposit_paid'
Paiement 2 (livraison)      → payments.kind = 'balance' → 'paid'
```

Les documents (devis, confirmation, bon de livraison) affichent systématiquement **« Reste à payer à la livraison : X € »** en gros. C'est ce qui évite le livreur qui arrive et découvre que le client croyait avoir tout payé.

### 6.4 Remboursements

Remboursement total ou partiel depuis l'admin, via l'API Stripe pour les paiements CB, en manuel (traçabilité uniquement) pour les autres modes. Génère une **facture d'avoir** liée à la facture d'origine.

---

## 7. Devis

Deux objets distincts à ne pas confondre.

### 7.1 Devis imprimable depuis le panier — *self-service*

Fonctionnalité demandée explicitement. Le client remplit son panier, saisit son code postal, clique **« Imprimer le devis »**, un PDF se télécharge immédiatement — **sans compte, sans email, sans validation**.

```
POST /api/pdf/devis  { cart_id, postal_code, city }
1. Recalcul serveur complet (produits, remises, livraison, carburant, TVA)
2. Génération du PDF @react-pdf
3. Enregistrement d'une trace anonyme (quote_downloads) pour statistiques
4. Renvoi du fichier en Content-Disposition: attachment
```

**Contenu du PDF :** en-tête entreprise (logo, SIRET, coordonnées) · date et heure d'édition · détail des lignes avec volume en m³ apparents et équivalent stères · frais de livraison détaillés (base + volume + carburant) · totaux HT / TVA / TTC · durée de validité.

**Mention obligatoire, en encadré, non discrète :**

> **Ce document est une estimation indicative.** Il ne constitue pas une offre commerciale ferme. Les prix affichés dépendent notamment du cours du bois et du carburant et peuvent évoluer à tout moment, y compris dans les minutes qui suivent l'édition de ce document. Seule une commande confirmée fixe le prix définitif.
> *Édité le {date} à {heure} · Prix du gazole retenu : {x,xx} €/L*

Cette mention est stockée en base (`company_settings.quote.disclaimer`) pour être ajustable sans redéploiement.

**Pourquoi c'est stratégique :** dans ce métier, beaucoup de clients comparent trois fournisseurs et présentent un papier au conjoint avant de décider. Donner le PDF immédiatement, sans formulaire, est un avantage de conversion majeur — et aucun concurrent ne le fait.

### 7.2 Demande de devis — *avec réponse humaine*

Formulaire pour les cas hors standard : gros volumes, professionnels, hors zone, besoin sur mesure.

**Champs :** nom, prénom, entreprise (optionnel), email, téléphone, adresse complète, essence souhaitée, longueur, quantité estimée, préférence de séchage, message libre.

**Déclencheurs automatiques** (le formulaire est pré-rempli avec le contexte) :
- code postal hors zone desservie,
- volume supérieur à la capacité du plus grand véhicule,
- frais de livraison calculés au-dessus de `delivery_fee_max_cents`,
- clic sur « Demander un devis » depuis le catalogue.

**Traitement admin :** la demande arrive dans `/admin/devis` avec un badge, l'admin voit une estimation pré-calculée qu'il peut ajuster, et répond par un devis PDF envoyé par email. Le devis accepté peut être **converti en commande en un clic** — c'est ce qui évite la double saisie.

**Implémenté** — décisions à ne pas défaire :

| Sujet | Choix retenu | Pourquoi |
|---|---|---|
| Demande vs proposition | La demande du client n'est **jamais** modifiée ; la proposition vit à côté (`proposal_lines`) | On doit toujours pouvoir relire ce que le client a réellement écrit |
| Stockage de la proposition | Uniquement `variantId` + quantité. Aucun prix de ligne en base | Même règle que le panier : le serveur rechiffre à chaque lecture (PLAN.md §5.1). Un devis d'il y a un mois affiche les prix du jour |
| Montants décidés | Seules la **remise** et la **livraison fixée à la main** sont stockées en centimes | Ce sont des décisions humaines, pas des calculs |
| Livraison hors zone | Champ de saisie libre, obligatoire quand la commune n'est pas desservie | C'est le cas le plus fréquent d'une demande de devis : le moteur n'a aucune grille à appliquer, il ne faut pas faire semblant |
| Remise | Passe par `computeOrderTotals` en `discount: fixed` | La remise s'applique avant la livraison et se ventile dans la TVA — le faire à la main ici aurait produit une TVA fausse |
| PDF | Même document que le devis du panier (`src/pdf/document-devis.tsx`), deux adaptateurs | Un client qui reçoit les deux doit reconnaître la même entreprise |
| Encadré du PDF | Le devis du panier porte la mention d'indicativité ; celui envoyé par l'exploitant porte une **durée de validité** | Une machine peut se dédire dans la minute, pas un patron qui envoie une offre nominative. Sans date saisie, on retombe honnêtement sur l'indicativité |
| Conversion | `next_document_number` + `reserve_order_stock`, exactement comme le tunnel client ; aucun créneau réservé | Une commande née d'un devis doit être indiscernable d'une autre. La date se cale au téléphone |
| Double conversion | Bloquée par `converted_order_id` | Deux clics créeraient deux commandes et réserveraient deux fois le stock |
| Statut de la commande créée | `nouvelle` (aucun mode de paiement arrêté) | Le règlement se décide plus tard ; tous les chemins restent ouverts (`initialStatus(null)`) |
| Échec d'envoi d'email | Le devis passe quand même en « envoyé », avec un message qui dit **franchement** que rien n'est parti et invite à télécharger le PDF | Tant que le domaine Resend n'est pas vérifié, prétendre le contraire ferait perdre des clients en silence |

**Anti-spam :** honeypot + rate limiting par IP (5/heure) + Turnstile si le volume de spam le justifie. Pas de captcha visible par défaut : ça coûte des leads.

---

## 7 bis. Factures, avoirs et bons de livraison — implémenté le 10 août 2026

### 7 bis.1 Trois documents, deux natures

| Document | Numéroté | Persisté | Qui l'édite | Rôle |
|---|---|---|---|---|
| **Facture** | `FAC-AAAA-NNNN`, séquence légale | Oui, `invoices` | Automatique à la livraison ; manuellement, le gérant | Pièce comptable |
| **Avoir** | Même séquence que les factures | Oui, lié à sa facture | Le gérant seul | Annulation d'une facture |
| **Bon de livraison** | Non — porte la référence de la **commande** | Non | `owner`, `staff` et `driver` | Document de terrain |

### 7 bis.2 Une facture est un instantané, jamais une vue

`invoices` stocke le document **entier** en JSON (`seller`, `buyer`, `lines`, `totals`, `vat_breakdown`), et le PDF est rendu depuis ce contenu figé. Il ne relit ni la commande, ni le catalogue, ni les réglages du moment.

C'est ce qui garantit qu'une facture rééditée deux ans plus tard sort **identique**, même si les prix ont bougé, si la raison sociale a changé ou si le taux de TVA a été révisé. C'est aussi ce qui prépare Factur-X : le format attend des données structurées, pas un PDF à reparser.

### 7 bis.3 Ce qui n'est jamais fait

- **On ne modifie pas une facture émise. On ne la supprime pas.** La correction passe par un avoir, qui porte son propre numéro et référence la facture annulée. La numérotation reste ainsi continue et sans lacune — la seule forme acceptable en contrôle.
- **On n'émet pas si le document ne se boucle pas.** `construireFacture()` vérifie que lignes + options − remise + livraison retombe **exactement** sur le total de la commande, et refuse sinon (`FactureIncoherenteError`). Une option oubliée dans la requête produirait sinon une facture inférieure à ce que le client a payé, et personne ne s'en apercevrait avant le bilan. L'écran affiche alors les deux montants et invite à vérifier la commande.
- **On n'invente pas de TVA.** La ventilation vient de `orders.vat_breakdown`, figée à la commande : la facture montre la TVA que le client a réellement payée. En franchise en base, elle est vide, le HT vaut le TTC, et l'article 293 B s'affiche.

### 7 bis.4 Émission automatique à la livraison

Le passage à `livree` émet la facture : la livraison est le fait générateur de la TVA sur une livraison de biens, et c'est à ce moment que la facture est due.

Deux garde-fous :

- **L'émission est idempotente.** Un passage rejoué, un double clic, deux onglets : une seule facture.
- **Elle n'est pas bloquante.** Si elle échoue, la commande reste livrée et le stock reste décrémenté ; l'erreur est journalisée et le gérant rattrape depuis la fiche commande. Perdre une livraison parce qu'une facture n'a pas pu s'écrire serait le pire des deux maux.

⚠️ **L'unicité est garantie par la BASE, pas par le code.** La vérification applicative « existe-t-elle déjà ? » suivie d'une insertion est un lire-puis-écrire, que `PLAN.md` (règle 5) interdit pour la numérotation : deux appels concurrents passaient tous les deux et consommaient deux numéros. Deux index partiels ferment la course (migration `20260810120000`) :

```sql
create unique index invoices_une_facture_par_commande on invoices (order_id) where is_credit_note = false;
create unique index invoices_un_avoir_par_facture     on invoices (parent_invoice_id) where parent_invoice_id is not null;
```

Sur violation (`23505`), le code relit et retourne le document déjà émis : l'appelant voulait une facture, elle existe.

### 7 bis.5 Mentions portées par la facture

Identification du vendeur (SIRET, RCS, APE, TVA intracommunautaire), identité de l'acheteur avec son SIRET s'il est professionnel, prix unitaire **hors taxe** par ligne (art. 242 nonies A du CGI, reconstitué depuis le TTC et figé à l'émission), ventilation de TVA par taux, total HT / TVA / TTC, déjà réglé et reste à payer.

Les mentions varient selon l'acheteur, et c'est testé :

| Cas | Mentions ajoutées |
|---|---|
| Client professionnel | Pénalités de retard au taux annuel + **indemnité forfaitaire de 40 €** (art. D441-5 c. com.) · échéance à 30 jours (art. L441-10) |
| Client particulier | « Paiement comptant à la livraison » · échéance = date de vente |
| Franchise en base | « TVA non applicable, article 293 B du CGI » |

### 7 bis.6 Le bon de livraison n'est pas une facture

Trois partis pris, tous dictés par l'usage réel :

1. **Aucun prix de vente — sauf le reste à encaisser**, en gros caractères. Le livreur doit savoir ce qu'il rapporte le soir ; c'est ce qui évite le client qui croyait avoir déjà tout payé (§6).
2. **La colonne « quantité livrée » est vide, à remplir au stylo.** Un chargement ne tombe jamais exactement juste ; pré-remplir la case, c'est obtenir une signature sur un chiffre que personne n'a vérifié.
3. **Pas de séquence propre.** Une séquence obligerait à persister chaque bon pour éviter les trous, et une réimpression — le cas le plus fréquent, l'exemplaire restant dans le camion — produirait un second numéro pour la même livraison. Ici, réimprimer redonne **exactement** le même document.

Il porte en revanche les **contraintes d'accès** du client, en braise : c'est la ligne la plus utile de la page pour le chauffeur.

### 7 bis.7 Accès aux documents

| Route | Qui |
|---|---|
| `GET /api/pdf/facture/[id]` | Membre de l'entreprise, **ou** client connecté propriétaire de la commande |
| `GET /api/pdf/bon-livraison/[id]` (id = commande) | `owner`, `staff`, `driver` |

Un invité non connecté n'accède pas à une facture, même avec son identifiant : le document porte un nom et une adresse. Vérifié : 403 sans session.

Les factures apparaissent sur la fiche commande de l'administration, sur la fiche client, et dans l'espace client sous « Vos documents ».

---

## 8. Promotions

```
Validation serveur d'un code :
1. Code existe, is_active, dans sa fenêtre de dates
2. used_count < max_uses
3. usages par ce client < max_uses_per_customer  (identifié par email)
4. subtotal >= min_order_cents ET volume >= min_volume_m3
5. si applies_to_variant_ids non vide : au moins une ligne concernée
→ retour { valid: true, discount_cents, label } ou { valid: false, reason }
```

`reason` est traduit en message clair : *« Ce code est valable à partir de 3 m³ — il vous manque 1 m³. »* Jamais « Code invalide » sec.

Le compteur `used_count` n'est incrémenté qu'à la **confirmation** de la commande, dans la même transaction que la réservation de stock.

---

## 9. Notifications

### 9.1 Matrice

| Événement | Email client | SMS client | Admin |
|---|---|---|---|
| Commande confirmée | ✅ | ❌ | ✅ notif in-app |
| Paiement reçu | ✅ | ❌ | — |
| Virement/chèque attendu (rappel J+3) | ✅ | ❌ | — |
| **Livraison confirmée** (date fixée) | ✅ | ✅ | — |
| **Rappel veille de livraison, 18h** | ✅ | ✅ | — |
| Livraison effectuée + facture | ✅ | ❌ | — |
| Commande annulée | ✅ | ❌ | ✅ |
| Demande de devis reçue ✅ | accusé de réception | ❌ | ✅ + email |
| Devis chiffré envoyé ✅ | ✅ + PDF joint | ❌ | — |
| Stock bas | — | — | ✅ email quotidien |
| **Récap quotidien 7h** | — | — | ✅ email |
| Produit de nouveau en stock | ✅ (opt-in) | ❌ | — |

**Le SMS est réservé aux deux moments qui comptent** : la confirmation de date et le rappel de la veille. C'est ce qui réduit les livraisons ratées, et c'est le seul usage qui justifie son coût.

### 9.2 Contenu de l'email de confirmation

Rédigé pour être lu en diagonale sur un téléphone :

> **Votre commande est confirmée — CMD-2026-0142**
> 4 m³ apparents (≈ 4 stères) de chêne/hêtre, bûches de 33 cm, bois sec
> Livraison souhaitée : mardi 14 octobre, matin
> **Nous vous confirmons la date sous 24 h.**
> Total : 458 € — payé par carte
> [ Voir ma commande ]  [ Créer mon compte en 1 clic ]

Le bouton « Créer mon compte en 1 clic » est un lien magique pré-authentifié : c'est là qu'on convertit un acheteur invité en client fidèle, au moment exact où il est satisfait.

### 9.3 Récap quotidien admin (7h)

> **Aujourd'hui, mardi 14 octobre**
> 6 livraisons · 18 m³ à charger · 1 840 € à encaisser dont 620 € en espèces
> 3 nouvelles commandes depuis hier · 1 demande de devis en attente
> ⚠️ 2 produits sous le seuil de stock
> [ Ouvrir la tournée du jour ]

Un seul email, tôt le matin, avec un bouton qui ouvre directement la feuille de tournée. C'est le point d'entrée quotidien de l'exploitant dans l'outil.

---

## 9 bis. Notifications — les quatre derniers modèles (10 août 2026)

La matrice §9.1 est désormais complète côté email. Quatre modèles se sont ajoutés, avec deux tâches planifiées.

| Modèle | Déclencheur | Destinataire |
|---|---|---|
| `rappel_veille` | cron `/api/cron/rappel-veille`, 16 h UTC | Client livré le lendemain |
| `livraison_effectuee` | passage à « livrée », **facture PDF jointe** | Client |
| `recap_quotidien` | cron `/api/cron/recap-quotidien`, 5 h UTC | Gérants + copie configurée |
| `alerte_stock` | avec le récap, une fois par jour au maximum | Gérants + copie configurée |
| `invitation_equipe` | invitation d'un utilisateur | Personne invitée |

### Ce qui garantit qu'on ne réveille personne deux fois

Chaque envoi programmé vérifie dans `notifications_log` qu'il n'a pas déjà eu lieu **le jour même**, pour cette entreprise et cette commande. Un cron rejoué par la plateforme — cela arrive — ne renvoie rien. Vérifié : le second appel de `/api/cron/rappel-veille` renvoie `ignores: 1`.

### Trois décisions

- **La facture est jointe depuis son instantané**, exactement comme la route de téléchargement : le PDF reçu par email et le PDF téléchargé sont le même document. Les faire diverger serait indéfendable en litige. Si le rendu échoue, l'email part quand même en annonçant que la facture suit — le client doit savoir que sa livraison est faite.
- **L'alerte de stock part avec le récap, pas à chaque commande.** Une alerte qui arrive dix fois par jour n'est plus lue au bout d'une semaine. Elle annonce une **date de rupture** calculée par `projeterStock` — la même projection que l'écran statistiques, pour que l'email et l'écran ne se contredisent jamais.
- **Le récap est une feuille de route, pas un tableau de bord.** Chaque bloc répond à « qu'est-ce que je fais ? » : ce qu'il y a à charger, ce qu'il faut encaisser, ce qui attend une décision, et les contraintes d'accès. Aucun indicateur de pilotage — ils sont dans l'écran statistiques.

⚠️ **Vercel planifie en UTC.** Pour un envoi à 7 h heure de Paris, il faudrait `0 5 * * *` en été et `0 6 * * *` en hiver. On retient 5 h UTC : en hiver le message arrive à 6 h, en avance plutôt qu'en retard. Le réglage `notifications.digest_time` reste un affichage, pas une planification.

Le contrôle d'accès des crons est mutualisé dans `src/lib/cron.ts` : à cinq tâches, cinq copies du même test devenaient un risque d'en oublier une. En production, seul l'en-tête `Authorization: Bearer` est accepté — le secret en paramètre d'URL finit dans les journaux d'accès.

**Dix tests rendent les quatre modèles pour de vrai** et relisent leur texte : un email est aussi invisible qu'un PDF avant d'arriver chez un client.

---

## 10. Panier serveur

Le panier est persisté en base (`carts` + `cart_items`), identifié par un cookie `cart_id` httpOnly, durée 30 jours.

**Pourquoi serveur et pas localStorage :**
- les prix, remises et frais sont recalculés à chaque affichage (pas de prix périmé),
- le panier survit au changement d'appareil pour un client connecté,
- il alimente la relance de panier abandonné (Lot 2),
- il est la source du devis PDF.

À la connexion, le panier invité est **fusionné** avec l'éventuel panier du compte (union des lignes, quantité maximale conservée, message explicite si fusion).

À chaque lecture, le panier revalide : variante toujours active ? prix inchangé ? stock suffisant ? Toute divergence produit un bandeau clair — *« Le prix du chêne 33 cm est passé de 104 € à 108 €. »* — jamais une correction silencieuse.

---

## 11. Moteur de statistiques

### 11.1 Deux familles de chiffres, jamais mélangées

- **Réalisé** : commandes, lignes de commande, paiements, mouvements de stock, historique de statut et devis. Ces données font foi pour le CA, les volumes, les délais et la rentabilité.
- **Potentiel** : événements anonymes du tunnel et blocages. Ils estiment la demande perdue à partir du panier recalculé par le serveur. Ils ne sont jamais ajoutés au CA.

Le CA affiché dans l'écran est le total TTC des commandes non annulées. Le prix réellement vendu au m³ exclut livraison et options, puis répartit la remise de commande au prorata des lignes avant de diviser par le volume vendu. Cette définition est identique pour le global, l'essence, la longueur, la zone et le mois.

### 11.2 Tunnel mesuré

```
session anonyme → panier avec produit → zone vérifiée → créneau consulté
                 → paiement consulté → commande créée
```

Chaque étape est enregistrée une seule fois par session de 30 minutes. L'abandon d'une étape est `sessions étape N - sessions étape N+1`. Une période antérieure au déploiement de l'instrumentation reste vide et l'interface affiche la date réelle de début de mesure : aucune reconstitution n'est faite.

### 11.3 Demande perdue

Motifs structurés : `out_of_zone`, `unknown_postal_code`, `out_of_stock`, `no_slot`, `payment_failed`. L'événement stocke le volume et le montant potentiel uniquement lorsqu'ils peuvent être recalculés depuis le panier ou la commande. Un doublon identique sur la même session et le même panier est ignoré pendant dix minutes.

### 11.4 Prévisions opérationnelles

- **Autonomie du stock** = stock disponible / vitesse quotidienne des ventes sur la fenêtre configurée.
- **Coût réel estimé d'une livraison** = carburant aller-retour au prix figé sur la commande + coût kilométrique du véhicule. La main-d'œuvre est explicitement exclue tant qu'elle n'est pas modélisée.
- **Client à réactiver** = client avec au moins deux commandes, dont la prochaine date estimée par l'intervalle médian tombe dans la fenêtre configurée.
- Les fenêtres et seuils vivent dans `company_settings` (`statistics.*`), pas dans l'interface.
