# 04 — Médias : architecture ImageKit

> **Règle du projet : 100 % des images et vidéos publiques passent par ImageKit.** Aucun fichier média n'est servi depuis `/public`, depuis Vercel, ni depuis Supabase Storage. Supabase Storage est réservé aux **documents privés** (factures, bons de livraison, exports comptables), qui ne doivent jamais transiter par un CDN public.

---

## 1. Mise au point préalable

> État transitoire : tant que le compte ImageKit et l'écran Médias ne sont pas branchés, le logo
> de marque peut être saisi dans `/admin/reglages` sous forme d'adresse HTTPS ou de chemin public.
> `company_themes.logo_media_id` reste la cible canonique du futur sélecteur de médias ; cette
> saisie évite de bloquer aujourd'hui le changement de société et de logo.

ImageKit est un **DAM + CDN de transformation**. Il stocke, optimise, redimensionne et distribue des médias qu'on lui fournit. **Il ne fournit aucun contenu** : il n'ira pas chercher des photos de bûcheronnage. La stratégie d'acquisition des visuels est traitée en §8 — c'est un chantier à part entière, et c'est le facteur de confiance n°1 du site.

Contrainte technique à connaître : **l'upload via l'API ImageKit accepte une URL, pas un chemin local.** Pour l'admin, on contourne cela avec l'upload direct navigateur → ImageKit (§4), qui est de toute façon la bonne architecture (le fichier ne transite pas par le serveur Next.js).

---

## 2. Configuration du compte

| Élément | Valeur |
|---|---|
| URL endpoint | `https://ik.imagekit.io/<id>` — stocké dans `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` |
| Clé publique | `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` |
| Clé privée | `IMAGEKIT_PRIVATE_KEY` — **serveur uniquement, jamais préfixée `NEXT_PUBLIC_`** |
| SDK serveur | `@imagekit/nodejs` |
| SDK client | `@imagekit/next` |
| Restriction de transformations non signées | **Activée** en production — empêche un tiers d'utiliser le compte comme CDN gratuit |
| Domaine personnalisé | Optionnel (`media.entreprise.fr`), recommandé en V2 pour le SEO |

### 2.1 Arborescence des dossiers

Le dossier racine porte le slug de l'entreprise : c'est ce qui rend le multi-tenant propre dès le départ.

```
/{company_slug}/
├── brand/          logo, logo-sombre, favicon, og-image
├── products/
│   └── {sku}/      photos produit, la première étant la principale
├── gallery/
│   ├── foret/      forêt, parcelles, saisons
│   ├── abattage/   abattage, débardage
│   ├── machines/   fendeuse, scie, tracteur
│   ├── sechage/    stockage, empilage, hangar
│   ├── livraison/  camion, déchargement
│   └── equipe/     portraits, mains, ambiance
├── guides/         illustrations d'articles
└── videos/         vidéos sources + posters
```

**Règle de nommage :** `kebab-case-descriptif.ext`, en français, sans accent, sans date. `chene-33cm-empile-hangar.jpg`, pas `IMG_4821.JPG`. Le nom de fichier compte pour le SEO images.

---

## 3. Modèle de données médias

Voir `docs/01` §3.4. Deux règles cruciales :

1. **On stocke `file_path`, jamais l'URL complète.** L'URL est reconstruite au rendu. Cela permet de changer d'endpoint, d'ajouter un domaine personnalisé ou de migrer sans toucher à une seule ligne de la base.
2. **`alt_text` est obligatoire pour publier.** L'admin refuse la mise en avant d'une image sans texte alternatif. C'est une contrainte d'accessibilité **et** de SEO.

Le champ `lqip` stocke une data-URI base64 minuscule (image 20 px floutée) générée à l'upload : elle sert de placeholder et supprime le décalage de mise en page (CLS).

---

## 4. Upload depuis l'administration

Architecture : **upload direct navigateur → ImageKit**, autorisé par des paramètres signés générés côté serveur. Le fichier ne passe pas par Vercel (pas de limite de taille de payload, pas de coût de bande passante).

### 4.1 Route d'authentification

`app/api/imagekit/auth/route.ts` :

```
1. Vérifier la session ET le rôle (owner | staff) — sinon 401
2. Rate limiting (30 requêtes / 5 min / utilisateur)
3. Générer { token, expire, signature } avec la clé privée
   expire = now + 600 s maximum
4. Retourner uniquement ces 3 valeurs + la clé publique
```

Cette route est la seule surface d'attaque de l'upload : **si elle n'est pas protégée, n'importe qui peut remplir le compte ImageKit.** Contrôle de rôle et rate limiting sont obligatoires, pas optionnels.

### 4.2 Pré-transformation à l'upload — indispensable ici

L'exploitant téléversera des photos de smartphone de 8 à 15 Mo. On les recadre **avant stockage** :

```
transformation: { pre: 'w-2560,q-82' }
```

L'original 12 Mo n'est jamais conservé à taille réelle : on stocke une version 2560 px de large, largement suffisante pour tous les usages du site, à environ 400 Ko. Sur un catalogue de 300 photos, c'est la différence entre rester dans le quota gratuit et payer.

Autres paramètres d'upload :

```
folder: `/${company_slug}/${dossier}`
useUniqueFileName: true
tags: [company_slug, dossier, ...tags métier]
customMetadata: { alt, essence, longueur_cm, saison }
extensions: [{ name: 'google-auto-tagging', maxTags: 5 }]   // optionnel, aide au tri
```

### 4.3 Après upload

```
1. ImageKit renvoie { fileId, filePath, width, height, size, thumbnailUrl }
2. Server Action : générer le LQIP (fetch de la variante `tr=w-20,bl-8,q-20` → base64)
3. INSERT dans media avec company_id
4. Formulaire de saisie du texte alternatif — bloquant avant publication
5. revalidateTag('media')
```

### 4.4 Gestionnaire de médias admin

Écran `/admin/medias` : grille, filtres par dossier et par tag, recherche par nom, glisser-déposer multiple, édition en ligne du texte alternatif, suppression avec confirmation (avec avertissement si le média est utilisé par un produit ou une page).

Une alternative existe — le **widget Media Library embarqué** d'ImageKit, qu'on peut insérer dans l'admin. Il est retenu pour le Lot 2 : il évite de réécrire un explorateur, mais son intégration visuelle avec notre design system est imparfaite, ce qui compte pour un produit vendu comme premium.

---

## 5. Diffusion

### 5.1 Transformations nommées

Définies **une seule fois** dans `src/lib/imagekit/transformations.ts` et référencées partout. Aucune chaîne de transformation écrite à la main dans un composant.

| Nom | Transformation | Usage |
|---|---|---|
| `productCard` | `w-640,ar-4-3,c-maintain_ratio,fo-auto,f-auto,q-auto` | Grille catalogue |
| `productHero` | `w-1400,ar-4-3,c-maintain_ratio,fo-auto,f-auto,q-auto` | Galerie fiche produit |
| `productThumb` | `w-160,h-160,c-maintain_ratio,fo-auto,f-auto,q-auto` | Miniatures, panier, admin |
| `heroFull` | `w-2400,ar-16-9,c-maintain_ratio,fo-auto,f-auto,q-auto` | Hero plein écran |
| `galleryTile` | `w-800,ar-1-1,c-maintain_ratio,fo-auto,f-auto,q-auto` | Mosaïque galerie |
| `storyWide` | `w-1600,ar-21-9,c-maintain_ratio,f-auto,q-auto` | Bandeaux narratifs |
| `avatar` | `w-200,h-200,c-maintain_ratio,fo-face,r-max` | Portraits équipe |
| `ogImage` | `w-1200,h-630,c-maintain_ratio,fo-auto,f-jpg,q-80` | Partage réseaux sociaux |
| `lqip` | `w-20,bl-8,q-20` | Placeholder flouté |

`f-auto` sert AVIF/WebP selon le navigateur, `q-auto` ajuste la qualité au contenu, `fo-auto` recentre intelligemment le recadrage. Ces trois paramètres sont systématiques.

### 5.2 Composant unique

Un seul composant `<Media />` enveloppe `@imagekit/next` et est **le seul point du code qui construit une URL ImageKit** :

```
<Media
  media={media}              // ligne de la table media
  preset="productCard"       // transformation nommée
  sizes="(max-width:768px) 100vw, 33vw"
  priority={false}
/>
```

Il gère automatiquement : `srcSet` responsive, `loading="lazy"` (sauf `priority`), `width`/`height` pour réserver la place, placeholder LQIP, `alt` depuis la base, et un état d'erreur si le média a disparu.

**Interdiction :** aucun `<img>` brut, aucun `next/image` sur un média ImageKit, aucune concaténation d'URL ailleurs.

### 5.3 Règles de performance

- Une seule image en `priority` par page — l'image LCP du hero.
- `sizes` renseigné correctement partout : c'est ce qui divise réellement la bande passante mobile.
- `preconnect` vers l'endpoint ImageKit dans le `<head>`.
- Les images sous la ligne de flottaison sont toujours en `lazy`.
- Le `Cache-Control` par défaut d'ImageKit (long) est conservé ; on purge le cache explicitement lors du remplacement d'un média (`client.cache.invalidation.create`).

---

## 6. Vidéo

La vidéo est un fort levier de confiance dans ce métier : voir la fendeuse fonctionner vaut cinquante lignes de texte.

### 6.1 Traitement

| Besoin | Solution ImageKit |
|---|---|
| Optimisation automatique | `tr=f-auto,q-auto` sur la source |
| Streaming adaptatif | ABR (HLS/DASH) pour les vidéos > 30 s |
| Poster | Frame extraite : `tr=so-3,f-jpg,w-1400` (seconde 3) |
| Extrait court | `tr=so-0,eo-12` — découpe sans réencodage manuel |
| Vidéo de fond muette | `tr=w-1600,q-70,f-mp4`, durée ≤ 12 s, boucle, `muted`, `playsinline` |
| Sous-titres | Génération automatique via le Video Player SDK (Lot 2) |

### 6.2 Usages prévus

1. **Hero d'accueil** — boucle silencieuse de 8 à 12 s (fendeuse en action ou bois qui tombe). Chargée uniquement sur desktop et connexion rapide ; sur mobile, l'image poster seule (économie de données, et le hero LCP reste rapide).
2. **Page savoir-faire** — 3 à 4 vidéos de 30 à 60 s, une par étape (abattage, fendage, séchage, livraison), lecture à la demande via le **Video Player SDK ImageKit**.
3. **Galerie** — vignettes vidéo mêlées aux photos, lecture en superposition.

**Règle stricte :** aucune vidéo en lecture automatique avec son. Aucune vidéo bloquante pour le LCP.

---

## 7. Sécurité et coûts

| Point | Décision |
|---|---|
| URL signées | Non nécessaires pour les médias publics. **Obligatoires** si des médias privés apparaissent un jour (photos de chantier client) |
| Transformations non signées | Restreintes en production |
| Documents privés | Supabase Storage, jamais ImageKit |
| Quotas | Le palier gratuit (20 Go de bande passante) suffit largement au démarrage ; la pré-transformation à l'upload est ce qui garantit qu'on y reste |
| Vidéo | Les unités de traitement vidéo sont facturées séparément — plafonner le nombre de vidéos à ~10 au lancement |
| Surveillance | `client.accounts.usage.get()` interrogé mensuellement, affiché dans les réglages admin |

---

## 8. Acquisition des visuels — chantier à part entière

Le site ne peut pas être premium avec des images de banque d'images génériques. Deux phases.

### 8.1 Phase 1 — placeholders sous licence (immédiat, pour développer)

Sélection d'une vingtaine de photos libres de droits (Unsplash / Pexels, licence commerciale vérifiée), téléversées **par URL** dans ImageKit via l'API — c'est exactement le mode d'upload supporté :

```
client.files.upload({ file: 'https://...jpg', fileName: 'placeholder-foret-01.jpg',
                      folder: '/{slug}/gallery/foret', tags: ['placeholder'] })
```

Le tag `placeholder` permet, le jour du remplacement, de lister et purger l'intégralité des visuels temporaires en une opération. **Aucun placeholder ne doit atteindre la production.**

### 8.2 Phase 2 — shooting réel (à planifier avec le client)

Une demi-journée en forêt + une demi-journée au dépôt. Idéalement en octobre-novembre : lumière rasante, brume matinale, feuillage.

**Liste de prises (30 photos, 5 vidéos) :**

*Forêt et abattage* — parcelle en contre-jour matinal · tronc au sol avec tronçonneuse posée · le bûcheron en action (casque, protections : c'est un signal de professionnalisme) · débardage au tracteur · empilement de grumes en bord de route.

*Atelier* — fendeuse en action (photo **et** vidéo lente) · bûches qui tombent dans la remorque · pile de bûches en gros plan, cernes nets · main tenant une bûche (échelle et matière) · testeur d'humidité planté dans une bûche affichant un chiffre — **cette photo est le visuel commercial le plus important du site**.

*Séchage et stock* — hangar avec bois empilé, perspective longue · comparatif visuel 25/33/50 cm alignés sur fond neutre (sert la règle de coupe) · palette filmée · filets empilés.

*Livraison* — camion sur route de campagne · déchargement en cours · bois déposé devant une maison · le livreur qui salue un client.

*Équipe* — portrait du patron, plein cadre, regard caméra, extérieur, lumière naturelle. **Pas de fond studio.** Ce portrait, seul, fait plus pour la confiance que toute la page « à propos ».

*Produits* — chaque variante sur fond neutre, lumière douce, même cadrage et même distance pour toutes : la cohérence de la grille catalogue en dépend.

**Directives techniques :** format 4:3 pour les produits, 16:9 pour les bandeaux, 1:1 pour la galerie. JPEG qualité maximale, 4000 px minimum au format long. Pas de filtre, pas de retouche colorée : ImageKit uniformise ensuite. Éviter le soleil de midi.

**Directives d'ambiance :** photographier le travail, pas les objets. Des mains, de la sciure, de la buée, de la boue. Un site trop léché sur ce métier sonne faux — la crédibilité vient de la matière.


---

## 9. État d'implémentation — 10 août 2026

**Fait, et fonctionnel dès que les clés seront renseignées.**

| Brique | Fichier |
|---|---|
| Transformations nommées | `src/lib/imagekit/transformations.ts` |
| Construction des URL et `srcSet` | `src/lib/imagekit/index.ts` |
| Composant unique `<Media />` | `src/components/media.tsx` |
| Route d'authentification d'upload | `src/app/api/imagekit/auth/route.ts` |
| Bibliothèque et téléversement | `/admin/medias` |

### Aucune dépendance ajoutée

Le format d'URL d'ImageKit est `<endpoint>/<chemin>?tr=<transformation>` ; la signature d'upload est `HMAC-SHA1(token + expire, clé privée)`. Les deux sont documentés et stables. Les implémenter coûte une trentaine de lignes et évite d'embarquer un SDK client dans le bundle pour concaténer une chaîne. Le jour où l'on veut le SDK officiel, `<Media />` est le seul point à changer.

### Pas de `next/image` sur un média ImageKit

L'optimiseur de Next re-téléchargerait et retraiterait une image qu'ImageKit a déjà servie au bon format et à la bonne taille : on paierait deux fois le même travail, et on perdrait `f-auto`. `<Media />` rend donc un `<img>` avec `srcSet`, dimensions réservées et LQIP. C'est le **seul** `<img>` autorisé du projet, et la règle est portée par un `eslint-disable` commenté.

### Dégradation sans compte ImageKit

Le compte n'est pas encore ouvert et les trois variables sont vides. Conséquences, toutes visibles et aucune bloquante :

- `<Media />` affiche un cadre neutre au bon ratio, sans erreur ;
- `/admin/medias` explique en clair quelles variables renseigner ;
- la route d'authentification répond `503` avec le même message ;
- la galerie publique annonce que les photos arrivent, plutôt que d'afficher des images de banque d'images en les faisant passer pour l'entreprise.

### Ce qui reste à faire

1. **Ouvrir le compte ImageKit** et renseigner les trois variables d'environnement.
2. **Suppression réelle des fichiers** : `/admin/medias` retire le média de la bibliothèque mais laisse le fichier chez ImageKit. Un fichier orphelin coûte moins cher qu'une image effacée par erreur ; le ménage se fait depuis leur console en attendant.
3. **Sélecteur de média dans la fiche produit** : la bibliothèque existe, le rattachement `product_media` se fait encore en base.
4. Widget Media Library embarqué — lot 2, comme prévu au §4.4.
