# 07 — Roadmap, lots de travail, recette

> **Stratégie validée : option A.** Un MVP mis en ligne rapidement, qui encaisse de vraies commandes, puis enrichissement guidé par l'usage réel. Les besoins d'administration ne se devinent pas — ils se découvrent en regardant l'exploitant travailler.

---

## 0. Préalables — à obtenir du client avant le Lot 1

Ces éléments bloquent le développement. À réclamer dès maintenant.

| Élément | Bloque |
|---|---|
| Raison sociale, SIRET, RCS, n° TVA, adresse | Mentions légales, factures |
| **Statut TVA** (assujetti ou franchise en base) — validé par le comptable | Tous les prix affichés |
| **Confirmation de la base de prix** (`map_delivered` vs `stere_1m_equivalent`, `PLAN.md` §3.3) | Le moteur de prix entier |
| Catalogue réel : essences, longueurs, séchages, prix, conditionnements | Catalogue |
| Liste des communes livrées + jours par commune | Zones |
| Véhicules : nom, capacité m³, consommation | Frais de livraison |
| Créneaux réels : jours, horaires, nombre max, volume max | Créneaux |
| Compte Stripe, RIB, compte ImageKit, compte Resend | Paiement, médias, emails |
| Nom de domaine | Mise en ligne |
| Logo (ou accord pour en créer un) | Thème |
| **Photos réelles** — planifier le shooting (`docs/04` §8.2) | Qualité perçue |
| Textes : historique de l'entreprise, méthode, engagements | Pages récit |
| CGV relues par un juriste | Ouverture des ventes |

---

## Lot 0 — Fondations — ✅ **FAIT**

**Livré :** Next.js 16.3 + TypeScript strict + Tailwind v4 + Turbopack · design tokens et typographie (`docs/03`) · couche métier pure `src/domain/` (unités, prix, livraison) avec 45 tests unitaires · Supabase local en Docker (ports 545xx) · **5 migrations** couvrant le schéma complet, les fonctions transactionnelles, la RLS et les GRANT · seed à deux entreprises · **test d'isolation multi-tenant** (`npm run db:test`) · résolution du tenant par domaine · thème injecté depuis `company_themes` · `src/proxy.ts` (session + espaces protégés) · types TypeScript générés depuis la base · accueil branchée sur les données réelles avec la règle de coupe et la jauge d'humidité.

**Recette — état :**

- [x] L'application démarre et le build de production passe
- [x] Un test automatisé prouve qu'une entreprise ne peut pas lire les données d'une autre — **et** qu'un visiteur anonyme n'a aucun privilège sur les données confidentielles
- [x] `npm run verify` enchaîne typecheck, lint, tests unitaires et test d'isolation
- [ ] Le changement de 6 valeurs hex en base change visiblement le thème — mécanisme en place (`themeToCss`), **à vérifier visuellement**
- [ ] Environnement `staging` sur Supabase hébergé — nécessite un compte
- [ ] Sentry et CI — non branchés

**Reste à traiter avant le lot 1 :** shadcn/ui non installé (les composants ont été écrits à la main pour l'instant) · client ImageKit et composant `<Media />` non faits (compte ImageKit requis) · Zod installé mais pas encore utilisé · la dette de rendu dynamique de `docs/01` §4.3.

**Commandes utiles :**

```bash
npm run db:start && npm run dev
```

```bash
npm run verify
```

---

## Lot 1 — MVP commercial *(≈ 5 à 6 semaines)*

### État d'avancement

**✅ Fait**

- Fiche produit : règle de coupe (échelle réelle), jauge d'humidité mesurée, sélecteur de quantité, prix en direct avec paliers dégressifs, encart pédagogique m³ apparent / stère
- Moteurs métier `src/domain/` : prix, paliers, TVA multi-taux, unités, zones, sélection de véhicule, surcharge carburant plafonnée, minimums de zone — **64 tests unitaires**
- Panier serveur (cookie httpOnly, tables sans privilège client), revalidation des prix et du stock à chaque lecture, divergences signalées et jamais corrigées en silence
- Vérification de zone **dès le panier**, levée d'ambiguïté quand un code postal couvre plusieurs communes, jours de livraison par commune
- Calcul de livraison bout en bout : zone → véhicule → carburant → arrondi, avec les quatre sorties de secours (hors zone, code postal inconnu, volume hors flotte, frais hors norme)
- **Devis PDF immédiat** depuis le panier, sans compte ni email, avec la mention d'indicativité et le prix du gazole retenu
- Demande de devis : formulaire validé, honeypot, limitation de débit, numérotation `DEV-AAAA-NNNN`, détection automatique de l'origine et rattachement du panier
- shadcn/ui intégré et remappé sur la charte (§9 bis de `docs/03`)

- **Tunnel complet en 4 étapes** : coordonnées, contraintes d'accès (véhicule, déchargement, absence autorisée), créneau souhaité avec double contrainte nombre + volume, paiement avec modes filtrés serveur
- **Création de commande transactionnelle** : numérotation `CMD-AAAA-NNNN`, snapshot des lignes, réservation de stock et de créneau par fonctions Postgres, historique de statut, jeton d'accès invité
- Machine à états des commandes en table de transitions, acompte déclenché par volume ou distance, plafond espèces de 1 000 € appliqué
- **Authentification** : mot de passe et lien magique, rôles `owner`/`staff`/`driver`, `requireRole()` en première ligne de chaque écran et de chaque action, comptes de démonstration dans le seed
- **Administration** : tableau de bord (chiffres du jour, points d'attention cliquables, activité du mois), liste des commandes avec filtres, fiche commande complète (confirmation de date, encaissement, transitions en libellés explicites, historique), **tournée du jour** avec mode de paiement et contraintes d'accès mis en évidence, liens Maps/Waze/Plans, itinéraire multi-étapes, impression, et « Marquer comme livrée » qui décrémente réellement le stock

**⏳ Reste à faire sur le lot 1**

- Stripe : PaymentIntent + webhook signé (la carte se masque proprement tant que les clés manquent)
- Compte client (l'authentification existe, l'espace client reste à faire), recommande en 2 clics
- Administration : **dashboard, liste et fiche commande, tournée du jour ✅ faits**. Restent stock, clients, devis, zones, créneaux et réglages — écrans actuellement en « chantier visible » plutôt qu'en lien mort
- Notifications Resend, factures, bons de livraison
- Pages contenu et SEO local, pages légales
- ImageKit et composant `<Media />`
- Cron carburant (`/api/cron/fuel-price`) — la lecture du prix et le repli fonctionnent, l'alimentation automatique reste à brancher

**Dettes ouvertes**

- Rendu dynamique de toutes les pages (`docs/01` §4.3) — bloquant pour l'objectif LCP
- Limitation de débit en mémoire dans `actions/devis.ts` — insuffisante en serverless, à porter en base ou Upstash
- Notification email du devis non branchée (attend le domaine et Resend)


### 1.1 Catalogue et fiche produit
Catalogue avec filtres · fiche produit complète · **règle de coupe** (élément signature) · jauge d'humidité · sélecteur de quantité avec prix en direct · encart pédagogique m³ apparent / stère · états de stock · galerie ImageKit.

### 1.2 Moteurs métier
`src/domain/` : prix et paliers · TVA · unités et coefficients · zones et distance · sélection de véhicule · surcharge carburant · disponibilité des créneaux · réservation de stock · machine à états. **Tests unitaires exhaustifs — ce lot ne se termine pas sans eux.**

### 1.3 Panier et devis
Panier serveur · vérification de zone dès le panier · frais calculés en direct · revalidation des prix et du stock · **bouton « Imprimer le devis » avec PDF et mention d'indicativité**.

### 1.4 Tunnel de commande
4 étapes · commande invité · autocomplétion d'adresse (API Adresse) · contraintes d'accès · choix du créneau souhaité · modes de paiement filtrés côté serveur · Stripe Elements + webhooks · espèces / chèque / virement · CGV horodatées · page de confirmation.

### 1.5 Compte client
Lien magique · création en 1 clic après commande · commandes, factures, adresses · **recommande en 2 clics**.

### 1.6 Administration
Dashboard · commandes (liste, fiche, statuts, paiements, **création manuelle**) · **tournée du jour** avec réordonnancement, liens Maps/Waze/Plans et impression · produits et variantes avec assistant de création · stock avec saisie rapide · clients · zones et communes avec « Tester une adresse » · créneaux · véhicules · carburant avec simulateur · médias · devis · réglages complets.

### 1.7 Contenu et pages
Accueil · notre entreprise · savoir-faire · galerie · livraison + pages communes · formulaire de devis · contact · pages légales · 4 guides.

### 1.8 Notifications
Resend + React Email : confirmation, paiement, livraison confirmée, rappel J-1, livraison effectuée + facture, devis reçu, récap quotidien 7h, alerte stock.

### 1.9 Documents PDF
Devis panier · facture · bon de livraison · feuille de tournée.

### Critères de recette du Lot 1

- [ ] Un client commande 3 m³ en 33 cm, livré à Annonay, payé par CB — de bout en bout, sur un vrai téléphone, **en moins de 2 minutes**
- [ ] Un client hors zone est basculé vers le devis sans impasse
- [ ] Le devis PDF se télécharge sans compte et porte la mention d'indicativité
- [ ] Un créneau atteignant sa limite de **volume** disparaît des propositions
- [ ] Le stock se réserve à la commande et se décrémente à la livraison
- [ ] Le prix du gazole se met à jour automatiquement et modifie les frais
- [ ] Le paiement en espèces disparaît au-delà de 1 000 €
- [ ] L'exploitant crée un produit, modifie un prix, ajoute du stock et confirme une livraison **sans assistance**
- [ ] La feuille de tournée s'imprime correctement et le lien multi-étapes fonctionne
- [ ] Lighthouse mobile ≥ 90 sur accueil, catalogue et fiche produit
- [ ] Les emails arrivent en boîte de réception (SPF/DKIM/DMARC validés)
- [ ] Aucun placeholder d'image en production
- [ ] Checklist de sécurité (`docs/06` §2.5) intégralement passée

---

## Lot 2 — Confort et croissance *(≈ 3 semaines, après 1 à 2 mois d'exploitation)*

**Priorisé par l'usage réel constaté, pas par ce document.** Candidats :

- **SMS** (confirmation + rappel J-1) — le meilleur rapport valeur/effort du lot
- **Optimisation automatique de tournée** (OSRM + 2-opt, proposition non imposée)
- **Statistiques poussées** : carte de chaleur du CA par commune, taux de retour annuel, rentabilité par zone
- **Simulateur « Combien de bois me faut-il ? »** — aimant SEO et outil de vente
- **Avis Google** intégrés (API Places, cache quotidien)
- **Promotions avancées** : offres saisonnières, remise première commande
- **Relance de panier abandonné** (email à J+1)
- **Granulés** activés si le client en vend
- **Widget Media Library** ImageKit dans l'admin
- **Vidéos** du savoir-faire avec le Video Player SDK
- **Vue livreur hors ligne** (PWA, file d'attente de synchronisation)

---

## Lot 3 — Produit vendable à plusieurs entreprises *(≈ 3 à 4 semaines)*

Objectif : passer de « un site multi-tenant » à « un produit qu'on installe en une journée ».

- Assistant d'installation d'une nouvelle entreprise (10 écrans guidés)
- Import de communes en masse par département avec calcul automatique des distances
- Bibliothèque de thèmes prêts à l'emploi (5 variantes de palette)
- Duplication d'un catalogue type
- Console `platform_admin` : liste des entreprises, usage, facturation
- Documentation d'exploitation + tutoriels vidéo pour les exploitants
- Sauvegarde et export par entreprise

**Test de validation du lot :** installer une deuxième entreprise fictive de A à Z, en une journée, **sans écrire une ligne de code**.

---

## Estimation globale

| Lot | Charge | Cumul |
|---|---|---|
| Lot 0 — Fondations | ~1 semaine | 1 |
| Lot 1 — MVP | ~5 à 6 semaines | 6-7 |
| Lot 2 — Confort | ~3 semaines | 9-10 |
| Lot 3 — Produit | ~3 à 4 semaines | 12-14 |

Hors développement : shooting photo (1 jour), rédaction des contenus (client), relecture juridique des CGV, création du Google Business Profile.

**Fenêtre de lancement recommandée : fin août / début septembre.** La saison de commande de bois démarre en septembre et culmine en octobre-novembre. Rater cette fenêtre coûte une année entière de chiffre d'affaires.

---

## Risques identifiés

| Risque | Impact | Parade |
|---|---|---|
| **Base de prix mal comprise** (§3.3) | Facturation fausse, litiges | Confirmation écrite du client **avant** le Lot 1 |
| **Pas de photos réelles au lancement** | Site premium qui ne convainc pas | Shooting planifié dès maintenant ; aucun placeholder en production |
| **L'exploitant n'adopte pas l'admin** | Stocks et statuts faux, site inutilisable | Test d'usage réel en fin de Lot 1, en le regardant faire sans l'aider |
| **Emails en spam** | Tunnel cassé | SPF/DKIM/DMARC validés avant ouverture, bloquant |
| **API carburant qui dérive** | Frais aberrants | Plafonds, contrôle de sanité 15 %, prix de repli, alerte |
| **Sur-ingénierie multi-tenant** | Retard du MVP | `company_id` + config en base uniquement ; aucune abstraction SaaS avant le Lot 3 |
| **Lancement hors saison** | Un an de perdu | Jalon calendaire ferme |
| **Litige DGCCRF sur les unités** | Amende | m³ apparent partout dans les documents légaux (§3.1) |

---

## Comment utiliser ce plan

1. `PLAN.md` fixe les règles métier et les décisions. **Il prime sur tout le reste.**
2. `docs/01` à `docs/06` détaillent chaque domaine. Les consulter avant d'implémenter, pas après.
3. Toute question non tranchée ici est une **question à poser**, pas une hypothèse à prendre.
4. Toute décision nouvelle est **écrite ici** avant d'être codée.
5. Les valeurs métier (coefficients, taux, seuils, textes) vont **en base**, jamais dans le code.
