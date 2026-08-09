# Prompt de reprise — à coller dans une nouvelle session Claude Code

> Copie tout ce qui suit la ligne de séparation. Ce fichier est régénérable :
> il résume l'état du projet tel que décrit dans `PLAN.md` et `docs/`.
> **Dernière mise à jour : 9 août 2026.**

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
la charte. Supabase local en Docker (ports 545xx). 11 migrations : schéma complet,
fonctions transactionnelles, RLS, GRANT, brouillon de commande, ordre de tournée,
relevés de carburant, traçabilité des fermetures de créneaux, proposition
commerciale des devis, rattachement des commandes à une fiche client. Seed à deux
entreprises + comptes de démonstration.
Résolution du tenant par nom de domaine, thème injecté depuis la base.

**Domaine métier testé** (`src/domain/`) : unités et coefficients d'empilage,
prix et paliers dégressifs, TVA multi-taux, zones et sélection de véhicule,
surcharge carburant plafonnée, créneaux à double capacité, moyens de paiement,
machine à états des commandes, relevé de carburant et statistiques. **207 tests unitaires.**

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

**Réglages.** `/admin/reglages` est opérationnel : entreprise, identité visuelle (nom, logo,
sous-titre, couleurs), commandes, rangement à 20 €/m³ modifiable, paiements, facturation,
notifications, textes légaux et fonctionnalités. Les écritures sont réservées au gérant et auditées.

**Espace client.** Connexion par lien magique sans mot de passe
(`/compte/connexion`), création de compte proposée à la confirmation de commande
et dans l'email, rattachement automatique des commandes passées en invité sur
l'email vérifié, et surtout **recommande en 2 clics** : le panier est rempli à
l'identique, l'adresse et les contraintes d'accès sont reprises, le client
atterrit directement sur le choix du créneau. Si un format a disparu, si un prix
a bougé ou si le stock ne suit plus, l'écran le dit et renvoie au panier.

## 4. Ce qu'il reste à faire, par ordre de valeur

1. **Factures PDF et bons de livraison** — `src/pdf/document-devis.tsx` sert de modèle (mise en page commune, deux adaptateurs). Attention : `invoices` stocke des données structurées, pas seulement un PDF, pour préparer Factur-X.
2. **Modèles d'email restants** : rappel la veille, livraison effectuée avec facture, récap quotidien à 7 h.
3. **Enrichissement clients et médias** — gestion client avancée, upload/sélecteur ImageKit et utilisateurs de l'entreprise.
4. **Pages de contenu et SEO local** — accueil narrative, notre entreprise, savoir-faire, galerie, guides, pages communes, pages légales (CGV, mentions, rétractation, confidentialité).
5. **ImageKit** — compte à créer, puis composant `<Media />` unique et transformations nommées (`docs/04`).

Les écrans d'administration inexistants affichent aujourd'hui un **chantier
visible** via `src/components/admin/ecran-a-venir.tsx` plutôt qu'un lien mort.
Garde ce principe : mieux vaut un périmètre lisible qu'une page d'erreur.

## 5. Dettes techniques ouvertes

- **Rendu dynamique de toutes les routes** (`docs/01` §4.3). La résolution du tenant lit `headers()`, donc tout est en `ƒ`. Incompatible avec l'objectif LCP < 2 s. Trois pistes documentées ; à trancher avant la mise en production.
- **Limitation de débit en mémoire** dans `src/server/actions/devis.ts` — inopérante en serverless, à porter en base ou Upstash.
- **`STRIPE_WEBHOOK_SECRET` absent** — le webhook est écrit mais inactif. En local : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. En attendant, le paiement aboutit par la vérification directe.
- **Domaine Resend non vérifié** — avec `onboarding@resend.dev`, aucun email ne peut partir vers un vrai client. Vérifier un domaine puis configurer SPF, DKIM et DMARC.
- **Sentry et CI** non branchés. **Environnement `staging`** inexistant.

## 6. Deux questions bloquantes pour le client

Elles sont dans `PLAN.md` §3.3 et §3.6, et ne sont **toujours pas tranchées** :

1. **La base de prix.** Les 104 €/m³ s'entendent-ils au **m³ apparent livré**
   (`map_delivered`, valeur actuelle) ou au **stère équivalent bois de 1 m** ?
   L'écart dépasse 30 %. Le fait que le client facture plus cher les coupes
   courtes (107 € en 25 cm contre 100 € en 50 cm) laisse penser à la seconde
   option. **Ne pas ouvrir les ventes avant confirmation écrite.**
2. **Le statut TVA** (assujetti ou franchise en base), à valider par son
   comptable. Les taux sont configurables par variante exprès.

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

Enchaîne typecheck, lint, 207 tests unitaires et le test d'isolation
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
- **Tiens `docs/07-ROADMAP.md` à jour** à chaque bloc terminé, et consigne dans
  les autres `docs/` toute décision ou tout piège rencontré — c'est ce qui a
  permis de ne pas répéter deux fois les mêmes erreurs.
- Commente le **pourquoi** des choix non évidents, pas le comment.
- Français partout : code, commentaires, interface, messages d'erreur.
