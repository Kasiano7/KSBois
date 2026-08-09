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

**Reste à traiter :** client ImageKit et composant `<Media />` (compte ImageKit requis) · la dette de rendu dynamique de `docs/01` §4.3. *(shadcn/ui et Zod ont depuis été intégrés — voir lot 1.)*

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

- **Écran stock** : ajout de production en deux gestes avec raccourcis, correction d'inventaire avec motif obligatoire, garde-fou contre une correction sous le volume déjà réservé, alertes de seuil, audit complet des mouvements avec auteur
- **Écran zones de livraison** : grilles tarifaires éditables (forfait, supplément au m³, seuil de gratuité, minimum, jours de passage), tableau des communes avec affectation **en masse**, ajout de commune, signalement des incohérences (zone vide, distance manquante), et surtout le simulateur **« Tester une adresse »** qui reproduit le calcul client avec son détail — y compris l'alerte quand le plafond carburant rogne la facturation
- **Emails transactionnels** : gabarit et deux modèles (confirmation de commande, livraison confirmée), service d'envoi journalisé dans `notifications_log`. Sans clé Resend, la notification est enregistrée en `queued` et le contenu affiché en console — **rien n'est perdu et l'interface le dit honnêtement à l'exploitant**

- **Paiement Stripe** : Elements en français, `PaymentIntent` avec idempotence, webhook signé et idempotent, et une **vérification directe auprès de l'API Stripe** en second chemin. Testé de bout en bout avec la carte `4242…` : commande `nouvelle → payee → à préparer`, encaissement et charge enregistrés
- **Envoi Resend opérationnel** : confirmation de commande et confirmation de livraison, journalisées `sent` avec identifiant fournisseur. Email de confirmation unifié dans `server/notifications-commande.ts`, construit depuis la COMMANDE (pas le panier) et idempotent
- **Relevé automatique du carburant** : cron quotidien sur l'open data officiel `data.economie.gouv.fr`, médiane départementale après élimination des aberrants (Tukey), contrôle de sanité à 15 %, relevés refusés conservés et acceptables en un clic, saisie manuelle et relance immédiate

- **Écran créneaux** (`/admin/livraison/creneaux`) : journées de livraison récurrentes créées et modifiables sans jargon (jour, horaires, libellé proposé automatiquement, capacités, véhicule, zones), refus des horaires qui se chevauchent, calendrier des huit prochaines semaines avec le remplissage des **deux** contraintes et la mention en clair de celle qui limite, ajustement de capacité date par date avec garde-fou contre un maximum inférieur au déjà réservé, fermeture d'une date avec motif, créneau exceptionnel hors modèle, périodes bloquées qui ferment réellement les créneaux existants et les rouvrent à l'annulation. Bandeau d'état de génération + **cron hebdomadaire** `/api/cron/generate-slots` : sans lui, l'horizon recule d'un jour par jour et le tunnel finit par ne plus proposer aucune date, sans aucun message d'erreur

- **Écran devis** (`/admin/devis` et `/admin/devis/[id]`) : liste filtrée avec compteurs et signalement des demandes en souffrance, fiche en deux colonnes (la demande du client d'un côté — jamais modifiée —, la proposition chiffrée de l'autre), composition des lignes par format et quantité avec reprise du panier du visiteur en un clic, livraison calculée automatiquement **ou fixée à la main** quand la commune est hors zone, remise ventilée dans la TVA par le moteur de prix, durée de validité, devis PDF, envoi par email avec le PDF joint, notes internes, et **conversion en commande en un clic** (numérotation et réservation de stock par les mêmes fonctions que le tunnel client, double conversion bloquée). Accusé de réception au client et alerte interne à l'arrivée d'une demande

- **Écran statistiques** (`/admin/statistiques`) : période globale et comparaison, origine web/téléphone/admin, prix réellement vendu au m³, tunnel complet et abandons, demande perdue chiffrée, autonomie et priorité de stock, performance des devis, coût réel des zones, délai commande → livraison, clients à réactiver, annulations/remboursements, promotions, devis PDF → commandes et SEO → CA. Instrumentation anonyme par sessions de 30 minutes, attribution figée sur les commandes et purge à 25 mois

- **Espace client et recommande en 2 clics** (`/compte`) : connexion par lien magique sans mot de passe, création de compte en un clic depuis la confirmation de commande et depuis l'email, **rattachement automatique des commandes passées en invité** sur l'email vérifié, dernière commande et bouton « Recommander la même chose » seuls au-dessus de la ligne de flottaison, historique, détail de commande, adresses de livraison. La recommande remplit le panier à l'identique, reprend adresse et contraintes d'accès, et emmène directement au choix du créneau — sauf si un format a été retiré, si un prix a bougé ou si le stock ne suit plus, auquel cas elle dit ce qui a changé et renvoie au panier
  - Correctif de fond au passage : le tunnel n'écrivait **aucune** fiche `customers` et ne renseignait jamais `orders.customer_id`. La policy `orders_customer_read` ne rendait donc aucune ligne — l'espace client aurait été vide pour tout le monde

**⏳ Reste à faire sur le lot 1**

- Modèles d'email restants : rappel la veille, livraison effectuée avec facture, récap quotidien
- **`STRIPE_WEBHOOK_SECRET` à obtenir** : le webhook est écrit, signé et idempotent, mais inactif sans son secret. En local : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. En production : créer le point de terminaison dans le tableau de bord Stripe. En attendant, le paiement aboutit par la **vérification directe** auprès de l'API Stripe après confirmation — pas par le navigateur
- **Domaine à vérifier chez Resend** : sans domaine vérifié, `onboarding@resend.dev` ne peut écrire qu'au titulaire du compte. Aucun client réel ne recevra d'email avant cette étape (+ SPF/DKIM/DMARC)
- Administration : **dashboard, liste et fiche commande, tournée du jour, stock et tarifs, zones de livraison, créneaux, devis et statistiques ✅ faits**. Restent clients et réglages — écrans en « chantier visible » plutôt qu'en lien mort
- Factures PDF et bons de livraison (le devis PDF sert de modèle : `src/pdf/devis.tsx`)
- Pages contenu et SEO local, pages légales
- ImageKit et composant `<Media />`
- ~~Cron carburant~~ ✅ **fait** : relevé quotidien sur l'open data officiel (`data.economie.gouv.fr`), médiane départementale après élimination des valeurs aberrantes, contrôle de sanité à 15 %, relevés refusés conservés et acceptables en un clic, saisie manuelle et relance immédiate. `vercel.json` planifie le passage à 10 h heure de Paris

**Dettes ouvertes**

- Rendu dynamique de toutes les pages (`docs/01` §4.3) — bloquant pour l'objectif LCP
- Limitation de débit en mémoire dans `actions/devis.ts` — insuffisante en serverless, à porter en base ou Upstash
- ~~Notification email du devis non branchée~~ ✅ branchée (accusé de réception, alerte interne, devis avec PDF joint). **Elle échoue tant que le domaine Resend n'est pas vérifié** : l'interface le dit explicitement et invite à envoyer le PDF à la main. Vérifié le 9 août 2026 en conditions réelles — erreur 403 « you can only send testing emails to your own address », journalisée en `failed` dans `notifications_log`


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
- **Carte de chaleur du CA par commune** et exports avancés — le pilotage ventes/tunnel/stock/devis/zones est déjà livré
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
