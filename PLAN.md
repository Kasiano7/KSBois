# PLAN DE DÉVELOPPEMENT — Plateforme de vente de bois de chauffage

> **Document de référence principal.** Toute décision technique ou produit doit être vérifiée ici avant implémentation. Si une information manque, elle doit être ajoutée ici avant d'écrire du code.

**Client pilote :** entreprise de bûcheronnage — 07690 Villevocance (Ardèche)
**Nom de code produit :** `Bûcheron` (plateforme white-label)
**Date du plan :** 8 août 2026
**Statut :** validé — prêt pour développement

---

## Sommaire des documents

| Fichier | Contenu |
|---|---|
| `PLAN.md` *(ce fichier)* | Vision, décisions actées, règles métier, unités, conformité légale |
| `docs/01-ARCHITECTURE.md` | Stack, arborescence du repo, routes, modèle de données SQL complet, RLS |
| `docs/02-MOTEURS-METIER.md` | Livraison, carburant, créneaux, stock, commandes, paiements, devis |
| `docs/03-DESIGN-SYSTEM.md` | Direction artistique, tokens, typographie, composants, parcours UX |
| `docs/04-MEDIAS-IMAGEKIT.md` | Architecture médias, code patterns, guide de shooting, placeholders |
| `docs/05-ADMIN.md` | Dashboard, tournée du jour, gestion produits/commandes/clients, statistiques |
| `docs/06-SEO-SECURITE-DEPLOIEMENT.md` | SEO local, sécurité, RGPD, environnements, CI/CD, monitoring |
| `docs/07-ROADMAP.md` | Découpage en lots, dépendances, critères de recette, estimation |

---

## 1. Vision produit

### 1.1 Le problème

Les trois concurrents identifiés (`jacquesrochettebois.fr`, `guigueboisdechauffage.fr`, `boisbuchemolinario.fr`) sont datés : pas de commande en ligne fluide, pas de calcul de livraison automatique, pas d'optimisation mobile, aucune preuve de confiance moderne. Le marché local est donc **techniquement sous-équipé**, alors que 100 % de l'audience cible arrive depuis un téléphone après une recherche Google.

### 1.2 La thèse

> **On vend la confiance dans le noir, on vend le bois dans la lumière.**

Le site fonctionne sur deux registres visuels assumés :

- **Registre récit** (accueil, entreprise, savoir-faire, galerie) — fond sombre, cinématographique, photos plein cadre. C'est là qu'on démontre qu'on est un vrai bûcheron avec une vraie forêt, pas un revendeur anonyme.
- **Registre transactionnel** (catalogue, fiche produit, panier, tunnel, compte) — fond clair, contraste maximal, typographie large, zéro fioriture. C'est là qu'un client de 62 ans doit pouvoir commander en moins de 2 minutes sans se tromper.

Cette rupture est délibérée et constitue l'identité du site. Elle est aussi fonctionnelle : le sombre valorise les photos de forêt et de feu, le clair maximise la lisibilité et la conversion.

### 1.3 Les trois objectifs, par ordre de priorité

1. **Convertir** — un client doit pouvoir commander en < 2 min sur mobile, sans compte obligatoire.
2. **Rassurer** — origine du bois, taux d'humidité mesuré, visage de l'équipe, avis Google, mentions légales complètes.
3. **Soulager l'exploitant** — l'admin doit remplacer le carnet papier, pas s'y ajouter. Si une fonction n'est pas utilisée au bout d'un mois, elle est supprimée.

### 1.4 Ce que le produit n'est pas

- Pas une marketplace multi-vendeurs.
- Pas un ERP de gestion forestière (pas de suivi de parcelles, de coupes, de main-d'œuvre).
- Pas un SaaS en libre-service au lancement. L'architecture est multi-tenant, le **déploiement est manuel** : on duplique une configuration, on change couleurs/logo/domaine.

---

## 2. Décisions actées

Récapitulatif des arbitrages validés. **Toute déviation nécessite une décision explicite.**

### 2.1 Business

| Sujet | Décision |
|---|---|
| Localisation | Villevocance (07690), Ardèche nord — bassin Annonay / Vallée du Rhône |
| Rayon de livraison | 60 km, configurable par entreprise |
| Volume cible | 50 à 100 commandes / mois en saison |
| Utilisateurs admin | 2 rôles actifs : `owner` (patron) + `staff` (secrétaire), plus `driver` (livreur, mobile) |
| Clientèle | Particuliers en majorité ; le B2B existe mais passe par le devis |
| Retrait sur place | **Oui**, mode de livraison à part entière (frais = 0) |
| Google Business Profile | À créer — tâche listée dans la roadmap, hors périmètre code |

### 2.2 Produits & prix

| Sujet | Décision |
|---|---|
| Structure | **Produit + variantes**. Un produit = une essence/gamme. Une variante = longueur × séchage × conditionnement |
| Prix de référence | 25 cm → 107 €/m³app · 33 cm → 104 €/m³app · 50 cm → 100 €/m³app |
| Base de prix | **Prix au m³ apparent de la longueur livrée** (voir §3.2 — point critique) |
| Prix dégressifs | Oui, paliers de quantité configurables par variante |
| Granulés / pellets | Développés mais **désactivables par flag** (`features.pellets`) |
| Conditionnements | Vrac (défaut), palette, filet, sac — chacun activable par flag |
| Options payantes | Système d'options configurables (rangement, petite quantité, allume-feu) |
| Rangement | **20 € TTC / m³ apparent par défaut**, modifiable dans `/admin/reglages`; TVA service **20 %**, snapshot sur la commande |
| Quantité minimum | Configurable globalement **et par zone** |

### 2.3 Livraison

| Sujet | Décision |
|---|---|
| Modèle de zones | **Par commune / code postal**, saisi et géré depuis l'admin |
| Formule | `frais = base_zone + (coef_m³ × volume) + surcharge_carburant` |
| Carburant | Récupération quotidienne du prix du gazole via **l'open data officiel français**, pas de scraping Total — voir `docs/02` §2 |
| Véhicules | Table `vehicles` configurable : nom, type, capacité m³, capacité palettes, consommation L/100 km |
| Jours de livraison | Configurables globalement et **par commune** |
| Présence client | Non requise — champ « autorisation de dépose en l'absence » |
| Hors zone | Génère une **demande de devis** avec validation manuelle du patron |
| Optimisation de tournée | Réordonnancement manuel (drag & drop) + lien Maps multi-étapes en V1. Optimisation automatique en V2 |

### 2.4 Commande, paiement, compte

| Sujet | Décision |
|---|---|
| Commande invité | **Oui**, parcours par défaut. Création de compte proposée en 1 clic après paiement (lien magique, sans mot de passe) |
| Moyens de paiement | Stripe (CB en ligne) · Espèces à la livraison · Chèque · Virement · SumUp (terminal physique dans le camion, hors ligne) — **chacun activable/désactivable par entreprise** |
| Plafond espèces | 1 000 € — le mode « espèces » se désactive automatiquement au-delà (configurable) |
| Acompte | Déclenché par seuil de **volume** et/ou de **distance**, pourcentage configurable |
| Codes promo | Oui, version simple (montant ou %, dates, usage unique/multiple, seuil minimum) |
| Devis imprimable | **Oui — bouton « Imprimer le devis » directement dans le panier**, PDF généré avec mention d'indicativité |
| Factures | PDF automatique + export comptable CSV |
| Statuts de commande | `nouvelle` → `en_attente_paiement` / `payee` → `a_preparer` → `prete` → `planifiee` → `livree` / `annulee` |
| Commande manuelle | **Obligatoire** — l'admin peut créer une commande de A à Z (client au téléphone) |
| Modification | L'admin peut modifier une commande, avec traçabilité complète |

### 2.5 Stock

| Sujet | Décision |
|---|---|
| Modèle | **Un stock vendable par variante**, avec 3 compteurs dérivés : `physique`, `réservé`, `disponible` |
| Rupture | Affichage « Rupture de stock », produit conservé (bon pour le SEO) |
| Précommande | Autorisée par variante (`allow_backorder`) avec date de disponibilité annoncée |
| Alerte stock bas | **Obligatoire** — seuil par variante, notification email + badge admin |

### 2.6 Technique

| Sujet | Décision |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions + RLS) |
| Médias | ImageKit — intégralité des images et vidéos |
| Paiement | Stripe (Checkout + Payment Intents + webhooks signés) |
| Email | Resend |
| SMS | Fournisseur à brancher (Brevo ou OVH) — uniquement confirmation + rappel J-1 |
| Hébergement | Vercel |
| Multi-tenant | `company_id` sur toutes les tables dès le jour 1, config 100 % en base, résolution par nom de domaine |
| Calculs sensibles | **Tous côté serveur.** Le client n'envoie jamais un prix, seulement des identifiants et des quantités |
| Langue | Français uniquement (i18n non câblée, mais textes centralisés) |
| Environnements | `local` → `preview` (données de démo) → `production` |
| Périmètre | **Option A : MVP d'abord**, enrichissement ensuite |

---

## 3. Règles métier fondamentales

> Cette section est la plus importante du document. Une erreur ici fausse les prix, les stocks et expose à un contrôle DGCCRF.

### 3.1 Le stère n'est pas une unité légale

Depuis le décret n° 75-1200, **le stère n'est plus une unité de mesure légale** en France pour la vente de bois de chauffage. La DGCCRF impose l'usage du **mètre cube apparent (m³ apparent, abrégé « m³app » ou « MAP »)**. Le stère reste toléré commercialement pour le bois en 1 m uniquement.

Or « stère » est **le** mot que les clients tapent sur Google et le seul qu'ils comprennent.

**Règle d'implémentation :**

- Unité canonique en base de données : `m3_apparent` (`numeric(10,3)`).
- Affichage client : `3 m³ apparents` en valeur principale, `≈ 3 stères` en mention secondaire.
- Un encart pédagogique dépliable « Stère ou m³ apparent ? » est présent sur chaque fiche produit et dans le panier.
- Le contenu éditorial et le SEO utilisent librement le mot « stère ».
- Les documents légaux (devis, facture, bon de livraison) affichent **obligatoirement le m³ apparent** en unité de facturation.

### 3.2 Coefficient d'empilage — le piège n° 1

**1 stère de bois en 1 m ne donne pas 1 m³ apparent une fois recoupé.** Plus les bûches sont courtes, plus l'empilage est dense, donc le volume apparent diminue.

| Longueur de coupe | Coefficient (m³app obtenu à partir de 1 stère de 1 m) |
|---|---|
| 1 m | 1,00 |
| 50 cm | 0,80 |
| 40 cm | 0,75 |
| 33 cm | 0,70 |
| 25 cm | 0,65 |

**Règle d'implémentation :**

- Table `cut_lengths` avec colonne `stacking_coefficient numeric(4,3)`, éditable depuis l'admin.
- Le coefficient sert à **deux** choses : la conversion de stock matière (V2) et l'affichage pédagogique client (« 1 stère de 1 m = 0,70 m³ apparent en 33 cm »).
- Ne **jamais** coder ces valeurs en dur dans le frontend.

### 3.3 Base de prix — ambiguïté à trancher explicitement

Les prix fournis (107 / 104 / 100 €) peuvent signifier deux choses radicalement différentes, avec un écart pouvant dépasser 30 % :

- **(A) `map_delivered`** — prix par m³ apparent **de la longueur livrée**. Le client qui commande 3 « stères » en 33 cm reçoit 3 m³ apparents de bûches de 33 cm. C'est la pratique dominante du marché et le **défaut retenu**.
- **(B) `stere_1m_equivalent`** — prix par stère équivalent 1 m. Le client qui commande 3 stères reçoit 3 × 0,70 = 2,10 m³ apparents en 33 cm.

**Règle d'implémentation :**

- Colonne `companies.pricing_basis` avec valeurs `'map_delivered' | 'stere_1m_equivalent'`, **défaut `map_delivered`**.
- Quel que soit le mode, la fiche produit affiche en clair : *« Vous recevrez X m³ apparents de bûches de 33 cm »*. Cette phrase est calculée, jamais saisie à la main.
- ⚠️ **À confirmer avec le client pilote avant mise en production.** Une erreur ici est une erreur de facturation.

### 3.4 Taux d'humidité — argument commercial et champ structuré

| Classe | Humidité | Libellé client | Usage |
|---|---|---|---|
| `H1` / sec | ≤ 20 % | « Bois sec — prêt à brûler » | Vente principale |
| `H2` / mi-sec | 20 – 35 % | « Mi-sec — à finir de sécher 6 mois » | Vente saison creuse |
| `H3` / vert | > 35 % | « Fraîchement coupé — séchage 18-24 mois » | Vente au printemps |

**Règle d'implémentation :** champ `humidity_class` sur la variante + champ optionnel `measured_humidity_pct` renseigné par lot. Quand il est renseigné, l'interface affiche une **jauge d'humidité mesurée** (élément signature — voir `docs/03`). C'est un différenciateur fort face aux concurrents qui écrivent « bois sec » sans preuve.

### 3.5 Essences

Table `wood_species` configurable. Valeurs initiales pour l'Ardèche nord, avec pouvoir calorifique indicatif :

| Code | Nom | Groupe | PCI indicatif (kWh/m³app) | Note client |
|---|---|---|---|---|
| `chene` | Chêne | G1 (dur) | ~2 000 | Braise longue, chaleur durable |
| `hetre` | Hêtre | G1 (dur) | ~2 050 | Le meilleur compromis flamme/braise |
| `charme` | Charme | G1 (dur) | ~2 100 | Le plus calorifique |
| `frene` | Frêne | G1 (dur) | ~1 950 | Brûle même peu sec |
| `chataignier` | Châtaignier | G2 | ~1 500 | Éclate — poêle fermé uniquement |
| `bouleau` | Bouleau | G2 | ~1 600 | Belle flamme, se consume vite |
| `mix_dur` | Mélange bois durs | G1 | ~2 000 | Offre standard |

Le châtaignier est très présent en Ardèche : il **doit** porter un avertissement « projections — déconseillé en cheminée ouverte ».

### 3.6 TVA

| Catégorie | Taux retenu par défaut |
|---|---|
| Bois de chauffage (bûches) | **10 %** |
| Granulés / briquettes de bois | **10 %** |
| Bois d'allumage | **10 %** |
| Frais de livraison | Taux du produit livré (prestation accessoire) |
| Prestation de rangement | **20 %** (service, hors régime du bois) |

**Règle d'implémentation :**

- `vat_rate` est une colonne sur la **variante**, pas une constante globale.
- `companies.vat_mode` : `'assujetti' | 'franchise_en_base'`. En franchise, tous les documents affichent la mention *« TVA non applicable, article 293 B du CGI »* et aucun montant de TVA.
- ⚠️ **À faire valider par le comptable du client pilote.** Les taux sont configurables précisément pour cette raison.

### 3.7 Conformité légale — obligations à implémenter

| Obligation | Implémentation |
|---|---|
| Mentions légales | Page statique alimentée par `companies` (SIRET, RCS, TVA intra, hébergeur, directeur de publication) |
| CGV | Page dédiée, version datée, **acceptation obligatoire par case à cocher non pré-cochée** avant paiement, horodatage stocké sur la commande |
| Droit de rétractation 14 jours | Applicable (vente à distance B2C). Page dédiée + **formulaire type de rétractation téléchargeable**. Clause spécifique sur les frais de retour d'un chargement de bois |
| Plafond espèces 1 000 € | Contrôle serveur : le mode `cash` est retiré des options si `total_ttc > cash_limit` |
| Médiateur de la consommation | Coordonnées obligatoires dans les CGV et le footer |
| Prix affiché | TTC pour les particuliers, avec mention « livraison en sus » ou montant exact selon l'étape |
| Bon de livraison | Volume en m³ apparent, longueur, essence, taux d'humidité, signature client |
| Facturation électronique B2B | Ne pas s'enfermer : `invoices` stocke des données structurées (pas seulement un PDF), pour permettre une émission Factur-X ultérieure |
| RGPD | Bannière cookies avec refus aussi accessible que l'acceptation, politique de confidentialité, registre, purge automatique des données après durée légale |

### 3.8 Arrondis et unités — règles strictes

- Tous les montants sont stockés en **centimes entiers** (`integer`), jamais en `float`.
- Les volumes sont stockés en `numeric(10,3)` m³ apparents.
- Les frais de livraison calculés sont arrondis **au 0,50 € supérieur** (configurable).
- La conversion TTC/HT se fait toujours depuis le TTC (prix de vente affiché) vers le HT, pas l'inverse.
- Le total d'une commande est **recalculé côté serveur** à chaque étape et re-vérifié avant capture du paiement.

---

## 4. Utilisateurs et rôles

| Rôle | Portée | Accès |
|---|---|---|
| `visitor` | Public | Catalogue, contenu, panier, devis PDF, commande invité |
| `customer` | Ses données | Compte, adresses, commandes, factures, recommande en 1 clic |
| `driver` | Sa tournée | Vue mobile « tournée du jour », changement de statut, encaissement, note de livraison |
| `staff` | Une entreprise | Tout l'admin sauf : réglages de paiement, réglages de facturation, suppression de données, gestion des membres |
| `owner` | Une entreprise | Tout l'admin |
| `platform_admin` | Toutes | Création d'entreprises, thèmes, flags — hors interface publique |

---

## 5. Principes de conception non négociables

1. **Le serveur est la seule source de vérité pour l'argent.** Prix, remises, frais de port, TVA, totaux : recalculés à chaque requête. Le panier client est un panier d'intentions (`variant_id` + `quantity`), rien d'autre.
2. **Aucune valeur métier en dur dans le code.** Coefficients, taux, seuils, zones, textes légaux : tout en base, tout éditable.
3. **Chaque table porte `company_id`.** Chaque requête est filtrée par RLS. Il n'existe aucun chemin de lecture sans tenant.
4. **Toute mutation d'argent ou de stock passe par une fonction Postgres transactionnelle.** Pas de lecture-puis-écriture depuis le serveur applicatif.
5. **Chaque écran admin doit être compréhensible sans formation.** Un libellé explicite bat une icône. Une action destructive demande confirmation avec le nom de l'objet retapé ou clairement affiché.
6. **Mobile-first strict.** Toute maquette est validée à 375 px avant 1440 px.
7. **Aucune fonctionnalité sans état vide, état de chargement et état d'erreur.**

---

## 6. Périmètre MVP (Lot 1) — ce qui est dans la boîte au lancement

**Inclus :** catalogue produits/variantes · fiche produit avec sélecteur de longueur · panier serveur · devis PDF depuis le panier · vérification de zone par commune · calcul de frais avec surcharge carburant · choix de créneau souhaité · commande invité · Stripe + espèces + chèque + virement · emails transactionnels · compte client + recommande · admin (produits, stock, commandes, clients, zones, créneaux, statistiques, réglages) · dashboard · tournée du jour · demande de devis · pages entreprise/savoir-faire/galerie · pages communes SEO · mentions légales/CGV/RGPD.

**Reporté (Lot 2+) :** optimisation automatique de tournée · SMS · granulés · multi-stock séchage · promotions avancées · carte de chaleur géographique · simulateur de besoin · application livreur hors-ligne · portail B2B avec tarifs négociés.

Détail complet et critères de recette : `docs/07-ROADMAP.md`.
