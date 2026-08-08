# 06 — SEO local, sécurité, RGPD, déploiement

---

## 1. SEO local

### 1.1 Le contexte réel

Villevocance (07690) est une petite commune du nord de l'Ardèche, dans le bassin d'Annonay. La concurrence en ligne est faible et techniquement dépassée : les trois sites identifiés n'ont ni données structurées, ni pages locales, ni performance mobile correcte. **L'opportunité est réelle et rapidement exploitable.**

Mais il faut être lucide sur la hiérarchie : pour une recherche « bois de chauffage Annonay », **le Google Business Profile pèse plus que le site**. Le site sert à convertir et à alimenter la fiche. Créer et optimiser le GBP est la tâche n°1 du plan marketing — hors périmètre code, mais listée dans la roadmap.

### 1.2 Architecture des URL

```
/                                          Accueil
/bois-de-chauffage                         Catalogue
/bois-de-chauffage/[slug]                  Fiche produit
/granules                                  Conditionné par flag
/livraison                                 Zones et tarifs (page pivot)
/livraison/[commune]                       Page locale
/notre-entreprise                          À propos, équipe
/savoir-faire                              Exploitation, séchage, essences
/galerie                                   Photos et vidéos
/guides                                    Index des guides
/guides/[slug]                             Article
/combien-de-bois                           Simulateur de besoin
/devis                                     Demande de devis
/contact
/mentions-legales · /cgv · /confidentialite · /retractation
```

**Aucune URL avec paramètres indexable.** Les filtres du catalogue utilisent des query strings marquées `noindex` ou du rendu client.

### 1.3 Pages communes — la règle anti-spam

Le piège classique est de générer 200 pages « bois de chauffage à {commune} » clonées. Google les traite comme du contenu de faible valeur, et elles peuvent pénaliser le site entier.

**Règle du projet : une page commune n'existe que si elle contient au moins 4 informations qui lui sont propres**, tirées de la base :

1. distance réelle depuis le dépôt et temps de trajet ;
2. jours de livraison spécifiques à cette commune ;
3. tarif de livraison réel et montant minimum de commande ;
4. délai de livraison constaté.

S'y ajoutent, quand ils existent : nombre de clients servis dans la commune, avis d'un client local, communes limitrophes également desservies, photo prise dans le secteur.

**Volume cible : 15 à 25 pages maximum**, correspondant aux communes réellement stratégiques (Annonay, Davézieux, Boulieu-lès-Annonay, Saint-Marcel-lès-Annonay, Vanosc, Saint-Julien-Molin-Molette, Sarras, Serrières, Roiffieux, Quintenas…). Les communes non prioritaires apparaissent dans le tableau de la page `/livraison`, sans page dédiée.

Une page commune sans contenu propre suffisant est automatiquement `noindex` — le contrôle est codé, pas laissé à la discipline.

### 1.4 Ciblage par page

| Page | Requête principale | Requêtes secondaires |
|---|---|---|
| Accueil | bois de chauffage Ardèche | vente bois de chauffage 07, bûcheron Ardèche |
| `/bois-de-chauffage` | acheter bois de chauffage | prix stère de bois, bois de chauffage sec |
| Fiche 33 cm | bois de chauffage 33 cm | stère de bois 33 cm prix |
| `/livraison` | livraison bois de chauffage Ardèche | zones de livraison bois |
| `/livraison/annonay` | bois de chauffage Annonay | livraison bois de chauffage Annonay, stère de bois Annonay |
| `/combien-de-bois` | combien de stères pour l'hiver | quantité bois de chauffage maison |
| Guides | comment stocker son bois de chauffage | taux d'humidité bois de chauffage, quelle essence choisir |

Le terme **« stère »** est employé librement dans les titres et le contenu éditorial — c'est ce que les gens cherchent. Le **« m³ apparent »** domine dans les zones transactionnelles et légales (`PLAN.md` §3.1).

### 1.5 Données structurées (JSON-LD)

| Type | Où | Contenu clé |
|---|---|---|
| `LocalBusiness` | Toutes les pages | Nom, adresse, GPS, téléphone, horaires, `areaServed` avec la liste des communes, `priceRange` |
| `Product` + `Offer` | Fiche produit | Prix, disponibilité, devise, `AggregateRating` si avis réels |
| `BreadcrumbList` | Toutes | Fil d'ariane |
| `FAQPage` | Fiches produit, pages communes, guides | 4 à 6 questions réelles |
| `Article` | Guides | Auteur, dates |
| `Service` + `areaServed` | `/livraison` | Zone de chalandise |

`AggregateRating` n'est publié **que** s'il repose sur de vrais avis Google. Toute donnée structurée inventée expose à une pénalité manuelle.

### 1.6 Technique

- `generateMetadata` sur chaque route ; titres ≤ 60 caractères, descriptions 140-158.
- `sitemap.xml` dynamique (produits, communes, guides) + `robots.txt`.
- URL canoniques absolues systématiques.
- Images : nom de fichier descriptif, `alt` obligatoire, `f-auto`/`q-auto` (`docs/04`).
- Open Graph et Twitter Card avec image `ogImage` générée par ImageKit.
- Pages produit en **SSG + ISR** (revalidation 1 h ou sur mutation par tag).
- Rendu serveur intégral du contenu indexable : aucun texte important injecté en JavaScript.
- **Cœur de la stratégie : la performance.** Un LCP sous 2 s sur mobile fait plus, ici, que n'importe quelle optimisation de mots-clés, parce que les concurrents sont lents.

### 1.7 Hors code — à faire avec le client

Création et optimisation du Google Business Profile (catégorie « Fournisseur de bois de chauffage », photos réelles, zone de service, horaires, posts saisonniers), inscription aux annuaires locaux pertinents, collecte active d'avis (QR code sur le bon de livraison, lien dans l'email post-livraison), et cohérence stricte du triplet Nom/Adresse/Téléphone partout.

---

## 2. Sécurité

Le site manipule des données personnelles, des adresses de domicile, des historiques d'achat et des paiements. Le niveau attendu est celui d'un produit vendu comme premium.

### 2.1 Authentification

- Supabase Auth, **lien magique par email en méthode principale** — supprime la gestion de mot de passe pour une audience peu à l'aise, et supprime du même coup toute une classe de vulnérabilités.
- Mot de passe optionnel ; si activé : minimum 12 caractères, vérification contre les fuites connues (HIBP k-anonymity), pas de règle de composition arbitraire.
- Sessions en cookies `httpOnly` `Secure` `SameSite=Lax`, rotation des refresh tokens.
- **2FA obligatoire pour le rôle `owner`** (TOTP) — c'est le compte qui accède aux réglages de paiement.
- Limitation stricte des tentatives de connexion : 5 par email et par IP sur 15 min, puis délai progressif.

### 2.2 Autorisation

- **RLS sur 100 % des tables** (`docs/01` §4). C'est la ligne de défense qui survit à une erreur applicative.
- Toute Server Action commence par un contrôle de rôle explicite. Un helper `requireRole(['owner','staff'])` est appelé en première ligne — jamais de contrôle implicite.
- La clé `service_role` n'apparaît que dans du code serveur, jamais dans une variable `NEXT_PUBLIC_`. Un test CI échoue si une clé sensible fuit dans le bundle client.
- Les commandes invité ne sont accessibles que par **token opaque signé** à durée limitée, jamais par référence devinable.
- Isolation multi-tenant vérifiée par des tests automatisés : un jeu de tests tente systématiquement de lire les données d'une autre entreprise et doit échouer.

### 2.3 Données et paiement

- **Aucune donnée de carte ne touche le serveur.** Stripe Elements, tokenisation côté Stripe, PCI-DSS SAQ-A.
- Webhooks Stripe : vérification de signature obligatoire, idempotence par `event.id`, rejet des événements de plus de 5 minutes.
- Prix, remises, frais et totaux **recalculés serveur** avant chaque création de PaymentIntent et re-vérifiés avant capture.
- Montants en entiers, jamais en flottant.
- Chiffrement au repos (Supabase) et en transit (TLS 1.3 partout, HSTS).
- Sauvegardes quotidiennes avec rétention 30 jours et **restauration testée** au moins une fois avant la mise en production.

### 2.4 Surface applicative

| Mesure | Détail |
|---|---|
| Validation | Zod sur **toute** entrée : formulaires, Server Actions, route handlers, webhooks, paramètres d'URL |
| Injection SQL | Requêtes paramétrées exclusivement ; aucune concaténation de SQL |
| XSS | React échappe par défaut ; `dangerouslySetInnerHTML` interdit sauf sur du markdown assaini (`rehype-sanitize`) |
| CSRF | Server Actions protégées nativement ; `SameSite` sur les cookies |
| Rate limiting | Devis 5/h/IP · connexion 5/15 min · upload 30/5 min · validation de code promo 20/h · API publiques 100/min |
| En-têtes | CSP stricte (avec l'endpoint ImageKit et Stripe en `allowlist`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimale |
| Upload | Types MIME et taille contrôlés côté serveur avant signature ImageKit ; rôle vérifié |
| Dépendances | Dependabot + `npm audit` bloquant en CI sur les vulnérabilités hautes |
| Journalisation | `audit_log` sur toute action sensible : changement de prix, de statut, de stock, remboursement, export de données |
| Secrets | Variables Vercel chiffrées, rotation documentée, aucun secret dans le repo (scan `gitleaks` en CI) |
| Erreurs | Sentry avec scrubbing des données personnelles ; aucune trace technique renvoyée au client |

### 2.5 Avant mise en production

Checklist bloquante : test de pénétration des politiques RLS · vérification qu'aucun secret n'est dans le bundle client · test de rejeu de webhook Stripe · test de manipulation de prix côté client · test d'accès inter-tenant · scan `npm audit` · en-têtes vérifiés sur securityheaders.com · restauration de sauvegarde testée.

---

## 3. RGPD

| Obligation | Implémentation |
|---|---|
| Base légale | Exécution du contrat pour les commandes ; consentement pour le marketing (case **non pré-cochée**, séparée des CGV) |
| Bannière cookies | Refuser aussi accessible qu'accepter, même taille et même contraste. Aucun cookie non essentiel avant consentement. Pas de *dark pattern* |
| Analytics | Vercel Analytics (sans cookie) ou Plausible auto-hébergé — évite la bannière pour la mesure d'audience |
| Politique de confidentialité | Page dédiée : finalités, durées, destinataires, droits, contact |
| Droit d'accès | Bouton « Télécharger mes données » dans l'espace client → export JSON |
| Droit à l'effacement | Demande depuis le compte → anonymisation du client, **conservation des factures 10 ans** (obligation comptable). Le message explique cette limite |
| Durées de conservation | Comptes inactifs 3 ans (avec relance avant purge) · paniers abandonnés 90 jours · logs 12 mois · factures 10 ans |
| Sous-traitants | Supabase, Vercel, ImageKit, Stripe, Resend — listés dans la politique, tous avec hébergement UE ou clauses adéquates |
| Registre | Modèle fourni au client, à tenir par lui |
| Minimisation | Aucun champ collecté « au cas où ». Chaque champ du formulaire doit justifier son existence |

---

## 4. Environnements et déploiement

### 4.1 Trois environnements

| Env. | Hébergement | Base | Données | Paiement |
|---|---|---|---|---|
| `local` | localhost | Supabase local (Docker) | Seed de démo | Stripe test |
| `preview` | Vercel Preview (par branche) | Projet Supabase `staging` | **Jeu de démo complet** — 12 produits, 30 commandes, 40 communes, 6 semaines de créneaux | Stripe test |
| `production` | Vercel, région `cdg1` | Projet Supabase `prod` | Réelles | Stripe live |

L'environnement `preview` avec données de démo est **explicitement demandé** : c'est là que le client valide l'outil avant l'ouverture, et c'est aussi la vitrine pour vendre le produit à d'autres entreprises.

### 4.2 Git et CI

- Branches : `main` (production) · `develop` (préproduction) · `feat/*`.
- Chaque PR déclenche : typecheck · lint · tests unitaires · build · Playwright sur le tunnel · scan de secrets · `npm audit`.
- Migrations Supabase versionnées dans `supabase/migrations/`, appliquées par la CI. **Aucune modification de schéma via l'interface Supabase** — la base doit être reconstructible à partir du repo, c'est la condition du multi-tenant.
- Conventional commits, changelog généré.

### 4.3 Mise en production

Séquence : migrations → déploiement → vérification santé → bascule DNS. Retour arrière par redéploiement de la version précédente sur Vercel (instantané) ; les migrations sont écrites pour être **rétrocompatibles** (ajout de colonnes nullables, jamais de suppression dans la même version que le code qui l'utilise).

### 4.4 Surveillance

Sentry (erreurs, avec alerte email au-delà d'un seuil) · Vercel Analytics et Speed Insights · alerte si le cron carburant échoue 2 jours de suite · alerte si un webhook Stripe échoue · surveillance de disponibilité externe (UptimeRobot) sur l'accueil et le tunnel · budget de performance vérifié en CI (Lighthouse CI, échec si Performance < 90 mobile).

### 4.5 Nom de domaine et emails

Domaine à acquérir (`.fr` recommandé pour le référencement local). Configuration DNS : A/CNAME vers Vercel, **SPF + DKIM + DMARC pour Resend** — sans quoi les emails de confirmation partent en spam, ce qui ruine tout le tunnel. Cette étape est bloquante avant l'ouverture.

---

## 5. Duplication pour une nouvelle entreprise

Procédure cible, à valider en fin de Lot 1 (c'est le test de qualité de l'architecture multi-tenant) :

1. Créer la ligne `companies` + `company_domains` + `company_themes` + `company_features`.
2. Renseigner les couleurs, le logo, les coordonnées et le dépôt depuis l'admin.
3. Importer les communes du secteur et les affecter aux zones.
4. Créer les véhicules, les créneaux, les produits (assistant en 3 écrans).
5. Téléverser les médias.
6. Brancher les clés Stripe et Resend de l'entreprise.
7. Pointer le domaine vers le même déploiement Vercel.

**Aucune ligne de code modifiée. Aucun redéploiement.** Si l'une de ces étapes exige une intervention développeur, l'architecture a un défaut à corriger avant de vendre le produit à un deuxième client.
