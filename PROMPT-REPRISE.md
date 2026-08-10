# Prompt de reprise — à coller dans une nouvelle session Claude Code

> Copie tout ce qui suit la ligne de séparation. Ce fichier est régénérable :
> il résume l'état du projet tel que décrit dans `PLAN.md` et `docs/`.
> **Dernière mise à jour : 10 août 2026 (fin du lot 1).**

---

Tu reprends le développement d'un site de vente et livraison de bois de chauffage,
déjà bien avancé. Le code est dans le dossier courant.

## 1. Lis la documentation avant de coder

Le projet a un plan écrit qui fait autorité. Lis-le, dans cet ordre :

- `PLAN.md` — vision, décisions actées, **règles métier** (unités légales, coefficients d'empilage, TVA, conformité). **Ce fichier prime sur tout le reste.**
- `docs/01-ARCHITECTURE.md` — stack, schéma SQL, RLS et GRANT, écarts Next.js 16
- `docs/02-MOTEURS-METIER.md` — prix, livraison, carburant, créneaux, stock, commandes, paiements, devis
- `docs/03-DESIGN-SYSTEM.md` — direction artistique, tokens, écarts assumés par rapport à shadcn/ui
- `docs/04-MEDIAS-IMAGEKIT.md`, `docs/05-ADMIN.md`, `docs/06-SEO-SECURITE-DEPLOIEMENT.md`
- `docs/07-ROADMAP.md` — **l'état d'avancement détaillé, à tenir à jour**

Lis aussi `AGENTS.md` : le projet tourne sur **Next.js 16.3**, qui comporte des
ruptures par rapport à Next 15 (`middleware.ts` → `proxy.ts`, `revalidateTag`
à deux arguments, `params`/`cookies()`/`headers()` toujours `await`, `next lint`
supprimé, `next typegen` requis après toute nouvelle route dynamique). La doc
version-exacte est dans `node_modules/next/dist/docs/`. **Consulte-la avant
d'écrire du code Next**, ne te fie pas à ta mémoire.

## 2. Règles non négociables

1. **Le serveur est la seule source de vérité pour l'argent.** Prix, remises, frais de port, TVA, totaux : recalculés côté serveur à chaque étape. Le panier client ne porte que des `variant_id` et des quantités.
2. **Aucune valeur métier en dur.** Coefficients, taux, seuils, zones, textes : tout en base, tout éditable depuis l'administration.
3. **`company_id` sur toutes les tables**, RLS activée et forcée partout. `anon` n'a de privilège que sur le catalogue public.
4. **RLS et GRANT sont deux barrières distinctes** — il faut les deux, et `service_role` a besoin de GRANT explicites (piège déjà rencontré, voir `docs/01` §4.0).
5. **Stock, créneaux et numérotation** passent par des fonctions Postgres transactionnelles, jamais par lecture-puis-écriture applicative.
6. **`requireRole()` en première ligne** de chaque écran et de chaque Server Action. Aucun contrôle implicite.
7. **Mobile-first strict**, cibles tactiles ≥ 44 px, corps de texte à 17 px, focus visible partout. L'audience a 55 ans et plus.
8. **Chaque écran d'administration** doit être utilisable sans formation : libellés écrits, jamais d'icône seule.
9. Le domaine métier (`src/domain/`) est **pur** : zéro I/O, zéro dépendance framework, 100 % testé.

## 3. Ce qui est fait

**Socle.** Next.js 16.3 + TypeScript strict + Tailwind v4 + shadcn/ui remappé sur
la charte. Supabase local en Docker (ports 545xx). 14 migrations : schéma complet,
fonctions transactionnelles, RLS, GRANT, brouillon de commande, ordre de tournée,
relevés de carburant, traçabilité des fermetures de créneaux, proposition
commerciale des devis, rattachement des commandes à une fiche client. Seed à deux
entreprises + comptes de démonstration.
Résolution du tenant par nom de domaine, thème injecté depuis la base.

**Domaine métier testé** (`src/domain/`) : unités et coefficients d'empilage,
prix et paliers dégressifs, TVA multi-taux, zones et sélection de véhicule,
surcharge carburant plafonnée, créneaux à double capacité, moyens de paiement,
machine à états des commandes, relevé de carburant et statistiques. **284 tests unitaires.**

**Parcours client complet.** Configurateur d'accueil en trois volets (longueur à
l'échelle réelle, essence, panneau « Votre sélection » avec le total en grand),
estimation de livraison par code postal, panier serveur, devis PDF immédiat sans
compte, tunnel en 4 étapes (coordonnées et contraintes d'accès, créneau souhaité,
paiement), commande invité, page de confirmation protégée par jeton opaque.

**Paiements.** Stripe Elements en français, `PaymentIntent` idempotent, webhook
signé et idempotent, **plus** une vérification directe auprès de l'API Stripe en
second chemin. Espèces, chèque, virement, terminal. Plafond espèces de 1 000 €
appliqué, acompte déclenché par volume ou distance. Testé de bout en bout.

**Emails.** Resend branché. Confirmation de commande et confirmation de
livraison, journalisées dans `notifications_log`. L'envoi se dégrade proprement
si la clé manque, et l'interface le dit honnêtement à l'exploitant.

**Administration.** Authentification (mot de passe et lien magique, rôles
`owner`/`staff`/`driver`), tableau de bord, liste et fiche commande avec
transitions et encaissement, **tournée du jour** (mode de paiement et contraintes
d'accès mis en évidence, liens Maps/Waze/Plans, itinéraire multi-étapes,
impression), **stock et tarifs** (production en deux gestes, correction avec
motif, modification de prix, ajout de format, création d'essence — publié
immédiatement sur le site), **zones de livraison** (grilles éditables,
affectation de communes en masse, simulateur « Tester une adresse »), panneau
carburant avec relevé automatique quotidien, **créneaux** (journées récurrentes
sans jargon, refus des horaires qui se chevauchent, calendrier de huit semaines
avec les deux jauges de capacité et la contrainte qui limite désignée en clair,
ajustement date par date, créneau exceptionnel, périodes bloquées réversibles,
bandeau de génération + cron hebdomadaire), **devis** (liste filtrée,
proposition chiffrée par le serveur, livraison automatique ou fixée à la main
hors zone, remise, validité, PDF, envoi par email avec pièce jointe, conversion
en commande en un clic sans ressaisie), **statistiques** (origine des ventes,
prix réel au m³, tunnel et abandons, demande perdue, autonomie du stock,
devis, rentabilité des zones, délais et clients à réactiver).

**Administration — refonte du 10 août 2026.** La coquille passe au **vert sapin**
de la maquette client par la seule classe `registre-admin`, qui redéfinit trois
tokens de surface : les dix écrans se repeignent sans avoir été touchés
(`docs/03` §9 quater). Navigation groupée en quatre familles, écran courant en
pastille sève. L'écran **statistiques** est réorganisé autour de courbes :
tuiles à micro-courbe, grande courbe du CA avec la période précédente en
pointillé, courbes commandes et volume, anneau des origines, jauges, barres
classées. Le pas de temps (jour / semaine / mois) se déduit de la durée
affichée. **Tous les graphiques sont du SVG rendu côté serveur**, sans
bibliothèque et sans un octet de JavaScript (`src/components/admin/graphiques/`,
géométrie testée dans `src/lib/graphiques.ts`).

⚠️ **La base ne contient aucune commande.** Ces écrans s'affichent donc à zéro
tant que l'on n'a pas lancé `npm run db:demo` (14 mois d'historique saisonnier,
idempotent, hors du glob de seed — il ne partira jamais en hébergé par erreur).

**Factures, avoirs et bons de livraison.** La facture est émise automatiquement
au passage en « livrée » — idempotente, et non bloquante si elle échoue. Son
contenu est un **instantané** figé en JSON dans `invoices` : le PDF ne recalcule
rien, une réédition deux ans plus tard sort identique. Elle refuse de s'émettre
si le détail ne retombe pas au centime sur le total encaissé. Une facture ne se
modifie ni ne se supprime : la correction passe par un **avoir**. La double
facturation est rendue impossible par deux index partiels en base, pas par une
vérification applicative. Le bon de livraison ne porte aucun prix sauf le reste
à encaisser, affiche les contraintes d'accès et laisse la quantité livrée à
remplir à la main ; il n'a pas de numéro propre et se réimprime à l'identique.
Voir `docs/02` §7 bis.

**Réglages.** `/admin/reglages` est opérationnel : entreprise, identité visuelle (nom, logo,
sous-titre, couleurs), commandes, rangement à 20 €/m³ modifiable, paiements, facturation,
notifications, textes légaux et fonctionnalités. Les écritures sont réservées au gérant et auditées.

**Clients.** `/admin/clients` et les fiches détaillées sont opérationnels : recherche instantanée,
indicateurs calculés depuis les commandes, adresses, historique, factures, notes, export CSV,
commande préremplie, blocage motivé, fusion de doublons et anonymisation RGPD atomique.

**Espace client.** Connexion par lien magique sans mot de passe
(`/compte/connexion`), création de compte proposée à la confirmation de commande
et dans l'email, rattachement automatique des commandes passées en invité sur
l'email vérifié, et surtout **recommande en 2 clics** : le panier est rempli à
l'identique, l'adresse et les contraintes d'accès sont reprises, le client
atterrit directement sur le choix du créneau. Si un format a disparu, si un prix
a bougé ou si le stock ne suit plus, l'écran le dit et renvoie au panier.

**Interface publique — refonte du 9 août 2026 sur maquette client.** Le client a
fourni une maquette de l'accueil ; elle a été suivie pour la mise en page, et les
écarts sont datés dans `docs/03` §9 ter. Concrètement :

- Les routes publiques vivent dans le **groupe `(site)`** (`page.tsx`, `panier`,
  `commande`, `devis`, `compte`, `connexion`) dont le layout appose l'en-tête.
  Le groupe n'ajoute **aucun segment d'URL**.
- **En-tête sur toutes les pages publiques**, avec la marque qui ramène à
  l'accueil, la navigation, les icônes compte et panier (pastille de comptage) et
  le bouton « Commander mon bois ». Deux variantes : posée sur la photo à
  l'accueil, barre pleine ailleurs.
- **Photo de héros** (`src/assets/heros-bucheron.png`) servie par `next/image`,
  avec deux voiles de lisibilité selon la taille d'écran.
- **Configurateur en une grande carte claire** qui chevauche le bas du héros, en
  trois volets alignés : longueur · type de bois · « Votre sélection ».
- **Bouton or** (`variant="or"`) sur les actions principales du parcours public.
  L'administration garde `cta` en braise.
- **Un seul idiome de sélection**, en vert sapin : carte pleine sur l'accueil,
  cadre + fond teinté dans le tunnel. L'orange ne marque plus jamais un choix.

**Fin du lot 1 — 10 août 2026.** Quatre chantiers livrés :

- **Notifications complètes** : rappel la veille, livraison effectuée avec la
  facture jointe, récap quotidien du matin, alerte de stock avec date de
  rupture, invitation d'équipe. Deux crons de plus, idempotents au jour près.
- **ImageKit** : transformations nommées, composant unique `<Media />`, route
  d'upload signée — **sans dépendance ajoutée**. ⚠️ Le compte n'est pas ouvert :
  tout dégrade proprement en attendant (cadre neutre, messages explicites).
- **Médias et utilisateurs** : `/admin/medias` avec téléversement direct vers
  ImageKit et texte alternatif obligatoire ; rôles et invitations dans les
  réglages, avec deux garde-fous (au moins un gérant, personne ne se retire
  soi-même).
- **Douze pages publiques** dont les quatre pages légales, sitemap et robots
  dynamiques, JSON-LD, pied de page avec maillage local. La règle anti-spam des
  pages communes est **codée** : sans distance mesurée et quatre informations
  propres, la page passe en `noindex` toute seule.

## 4. Ce qu'il reste à faire, par ordre de valeur

**Le lot 1 est terminé côté code.** Ce qui reste ne dépend pour l'essentiel plus
du développement.

1. **Ouvrir le compte ImageKit** et renseigner les trois variables
   d'environnement. L'intégration est faite et testée ; sans les clés, tous les
   emplacements d'images affichent un cadre neutre et la galerie annonce que les
   photos arrivent. C'est le blocage le plus visible côté client.
2. **Faire relire les CGV et les pages légales par un juriste.** Elles sont
   écrites pour décrire ce que le site fait réellement — moyens de paiement
   activés, plafond espèces appliqué, unité de vente légale — mais ce n'est pas
   un travail de développeur. Point délicat signalé sur `/retractation` : le
   bois coupé sur mesure peut relever de l'exception L221-28 3°.
3. **Exposer le sélecteur de base de prix** (m³ apparent / stère) dans l'écran
   stock. La colonne `companies.pricing_basis` existe et le domaine la respecte ;
   seule l'interface manque.
4. **Catalogue et fiches produit dédiés** (`/bois-de-chauffage`,
   `/bois-de-chauffage/[slug]`) plus `/combien-de-bois`, avec le JSON-LD
   `Product`/`Offer`. Le configurateur d'accueil en tient lieu aujourd'hui.
5. **Sélecteur de média dans la fiche produit** : la bibliothèque existe, le
   rattachement `product_media` se fait encore en base.
6. **Photos réelles** — shooting à planifier. Aucun placeholder en production :
   c'est une règle du projet, et la galerie la respecte.

**Tous les écrans d'administration existent désormais** : plus aucun n'utilise
`src/components/admin/ecran-a-venir.tsx`, qui est donc du code mort à supprimer
(ou à garder si tu ouvres un nouveau chantier — le principe reste bon : mieux
vaut un périmètre lisible qu'une page d'erreur).

**Mise en ligne.** Le dépôt GitHub existe et `main` est poussé, mais rien n'est
déployé : `.env.local` ne connaît que le Supabase local. Avant Vercel il faut un
projet Supabase hébergé (migrations + seed), les variables d'environnement, le
point de terminaison Stripe et un domaine vérifié chez Resend.

## 5. Dettes techniques ouvertes

- **Rendu dynamique de toutes les routes** (`docs/01` §4.3). La résolution du tenant lit `headers()`, donc tout est en `ƒ`. Incompatible avec l'objectif LCP < 2 s. Trois pistes documentées ; à trancher avant la mise en production.
- **Limitation de débit en mémoire** dans `src/server/actions/devis.ts` — inopérante en serverless, à porter en base ou Upstash.
- **`STRIPE_WEBHOOK_SECRET` absent** — le webhook est écrit mais inactif. En local : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. En attendant, le paiement aboutit par la vérification directe.
- **Domaine Resend non vérifié** — avec `onboarding@resend.dev`, aucun email ne peut partir vers un vrai client. Vérifier un domaine puis configurer SPF, DKIM et DMARC.
- **Sentry et CI** non branchés. **Environnement `staging`** inexistant.

## 6. Décisions client du 10 août 2026 (anciennes questions bloquantes)

Les deux questions de `PLAN.md` §3.3 et §3.6 sont **tranchées**. Elles ne
bloquent plus la mise en vente, mais l'une reste à implémenter :

1. **La base de prix — le client choisit lui-même.** Au lieu de figer le m³
   apparent livré ou le stère équivalent 1 m, la bascule devient un réglage de
   l'écran **Stock et tarifs**. La colonne `companies.pricing_basis` existe déjà
   et porte le choix ; le domaine de prix la respecte.
   ⏳ **Reste à faire : exposer le sélecteur dans l'écran stock.** Aujourd'hui la
   valeur n'est modifiable qu'en base.
   ⚠️ Ce choix ne touche **que l'expression du prix**. L'unité des documents
   légaux reste le mètre cube apparent en toutes circonstances — devis, facture,
   bon de livraison. Le stère n'y figure qu'en équivalence indicative. Une
   bascule en mode stère ne doit jamais changer une facture d'unité.
2. **Le statut TVA — réglage manuel.** Les vendeurs de bois relèvent en pratique
   du même régime (assujetti à 10 %) ; le cas particulier se règle dans
   **Réglages → Paiement et facturation**, où le régime et les taux sont déjà
   éditables. En franchise en base, la facture porte automatiquement l'article
   293 B et n'affiche aucun montant de TVA. À faire confirmer par le comptable
   avant la première déclaration, pas avant la première vente.

Par ailleurs, seule la gamme « Chêne / Hêtre » porte les prix réels du client.
Les trois autres (Chêne, Mix bois durs, Bois tendre) ont des **écarts de prix
supposés**, signalés en tête de `supabase/seeds/02-essences.sql`. Le client peut
désormais les corriger lui-même depuis l'écran stock.

## 7. Démarrer et vérifier

```bash
npm run db:start && npm run dev
```

Si Docker Desktop a été arrêté, il faut le relancer avant `db:start`, sinon
toutes les pages tombent en erreur `fetch failed`.

```bash
npm run verify
```

Enchaîne typecheck, lint, 284 tests unitaires et le test d'isolation
multi-tenant. **Il doit rester à zéro.** Comptes de démonstration :
`patron@demo.local` et `secretariat@demo.local`, mot de passe `demo1234`.

## 8. Comment je veux que tu travailles

- **Vérifie, n'affirme pas.** Ce projet a été construit en testant chaque
  fonctionnalité dans un vrai navigateur et en relisant la base après chaque
  écriture. Plusieurs bugs sérieux n'ont été trouvés que comme ça : un email de
  confirmation jamais envoyé, un plafond carburant qui rognait la facturation en
  silence, une équivalence en stères qui ignorait la longueur de coupe, React qui
  vidait les formulaires après une erreur de validation.
- **Signale les problèmes que tu trouves**, même hors périmètre, plutôt que de
  les contourner. Dis clairement ce qui n'est pas fait ou pas vérifié.
- **Quatre pièges d'interface déjà payés**, tous documentés dans `docs/03` §9 ter :
  `object-cover` sur le héros faisait varier la taille du bûcheron de 40 % selon
  le ratio de fenêtre (on pilote la largeur seule, jamais `cover` sur grand
  écran) ; une `<legend>` s'ancre sur la bordure de son `<fieldset>` et **ignore
  son `padding-top`** ; l'en-tête collante recouvrait la barre de l'espace
  client ; un compteur de clés au niveau du module faisait diverger les `id`
  entre serveur et client.
- **Le dépôt n'a aucune configuration Prettier** et Prettier n'est pas une
  dépendance déclarée. Si tu formates, passe `--print-width 100` : sans ça tout
  repasse à 80 colonnes et le diff explose. `npm run verify` ne vérifie pas le
  formatage.
- **Tiens `docs/07-ROADMAP.md` à jour** à chaque bloc terminé, et consigne dans
  les autres `docs/` toute décision ou tout piège rencontré — c'est ce qui a
  permis de ne pas répéter deux fois les mêmes erreurs.
- Commente le **pourquoi** des choix non évidents, pas le comment.
- Français partout : code, commentaires, interface, messages d'erreur.
