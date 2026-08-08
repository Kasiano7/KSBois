# 02 — Moteurs métier

> Tout le code de cette section vit dans `src/domain/`. **Zéro I/O, zéro dépendance framework, 100 % couvert par des tests unitaires.** C'est le patrimoine réutilisable du projet.

---

## 1. Moteur de prix

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
   → correspondance exacte prioritaire
2. Si absent, chercher par postal_code seul
   → si plusieurs communes, demander à l'utilisateur de choisir sa commune
3. Si is_served = false ou aucune correspondance :
   → retour { served: false } → bascule vers le parcours DEVIS (§7)
4. Sinon retour { zone, distance_km, delivery_days }
```

**Point UX critique :** ce contrôle intervient **dès le panier**, pas au paiement. Un client qui découvre au moment de payer qu'on ne le livre pas est un client perdu et énervé. Le panier affiche un champ « Votre code postal » et calcule les frais en direct.

**Alimentation de `zone_communes` :** import initial depuis la base officielle des communes (code INSEE + code postal), filtré sur un rayon autour du dépôt. L'admin voit ensuite une liste triable « Commune → Zone → Distance → Jours » et affecte les communes en masse. C'est l'écran d'administration le plus important à soigner.

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

**Anti-spam :** honeypot + rate limiting par IP (5/heure) + Turnstile si le volume de spam le justifie. Pas de captcha visible par défaut : ça coûte des leads.

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
| Demande de devis reçue | accusé de réception | ❌ | ✅ + email |
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

## 10. Panier serveur

Le panier est persisté en base (`carts` + `cart_items`), identifié par un cookie `cart_id` httpOnly, durée 30 jours.

**Pourquoi serveur et pas localStorage :**
- les prix, remises et frais sont recalculés à chaque affichage (pas de prix périmé),
- le panier survit au changement d'appareil pour un client connecté,
- il alimente la relance de panier abandonné (Lot 2),
- il est la source du devis PDF.

À la connexion, le panier invité est **fusionné** avec l'éventuel panier du compte (union des lignes, quantité maximale conservée, message explicite si fusion).

À chaque lecture, le panier revalide : variante toujours active ? prix inchangé ? stock suffisant ? Toute divergence produit un bandeau clair — *« Le prix du chêne 33 cm est passé de 104 € à 108 €. »* — jamais une correction silencieuse.
