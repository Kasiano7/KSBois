# 03 — Direction artistique & design system

> **Note méthodologique.** La base de données `ui-ux-pro-max` a renvoyé pour cette requête : pattern *Enterprise Gateway*, style *Conversion-Optimized*, palette orange `#EA580C` + bleu `#2563EB`, typographie *Amatic SC + Cabin*. **Ces recommandations sont écartées.** Amatic SC est une display manuscrite légère qui lit « brocante » et non « premium » ; orange + bleu confiance est la palette e-commerce générique par défaut ; *Enterprise Gateway* est un pattern B2B SaaS sans rapport avec un tunnel d'achat grand public. La direction ci-dessous est dérivée du sujet lui-même. Les **contraintes d'accessibilité et la checklist de pré-livraison** issues du skill sont, elles, intégralement retenues (§9).

---

## 1. La thèse visuelle

> **On vend la confiance dans le noir, on vend le bois dans la lumière.**

Deux registres, une seule identité.

**Registre récit — sombre.** Accueil, notre entreprise, savoir-faire, galerie, pages communes. Fond écorce quasi noir, photographies plein cadre, typographie display large. La forêt, le feu, l'acier des machines et la sciure ne rendent bien que sur du sombre. C'est là qu'on prouve qu'il y a un vrai bûcheron derrière le site.

**Registre transactionnel — clair.** Catalogue, fiche produit, panier, tunnel, compte client. Fond papier clair, contraste maximal, corps de texte à 17 px, boutons pleine largeur sur mobile. Zéro effet, zéro parallaxe, zéro dégradé. Un client de 62 ans doit pouvoir commander sans hésiter.

La transition entre les deux se fait franchement, sur une ligne horizontale nette, sans dégradé de fondu. La rupture est l'effet.

**L'admin** est un troisième registre : sombre, dense, fonctionnel — mais avec des libellés en toutes lettres et des zones de clic généreuses, parce que l'exploitant n'est pas un utilisateur avancé.

---

## 2. Palette

Dérivée de la matière : écorce, aubier, braise, cendre, sève, sapin. Aucune couleur n'est choisie pour « faire e-commerce ».

```css
:root {
  /* Sombre — registre récit */
  --ecorce:        #171310;  /* fond principal sombre — brun quasi noir, pas un gris */
  --ecorce-eleve:  #241D18;  /* cartes, surfaces surélevées */
  --ecorce-bord:   #352C24;  /* bordures sur sombre */

  /* Clair — registre transactionnel */
  --aubier:        #F4F2EC;  /* fond principal clair — bois fraîchement fendu */
  --aubier-pur:    #FFFFFF;  /* cartes produit, champs de formulaire */
  --aubier-bord:   #DFD9CD;  /* bordures sur clair */

  /* Couleurs de marque */
  --sapin:         #22392C;  /* vert conifère profond et FROID — actions principales */
  --sapin-clair:   #2E4C3A;  /* survol */
  --braise:        #C4501B;  /* accent unique — prix, badges, CTA de conversion */
  --braise-texte:  #A83F12;  /* variante pour petit texte sur fond clair (AA) */
  --seve:          #D9A441;  /* or discret — badges "bois sec", décorations rares */

  /* Neutres */
  --cendre:        #6E6459;  /* texte secondaire sur clair */
  --cendre-clair:  #A79C8E;  /* texte secondaire sur sombre */
  --encre:         #14100D;  /* texte principal sur clair */

  /* Sémantique */
  --succes:        #2F6B45;
  --alerte:        #B45309;
  --erreur:        #A32020;
  --info:          #2C4E63;
}
```

### 2.1 Discipline d'usage

| Couleur | Usage autorisé | Interdit |
|---|---|---|
| `--braise` | Prix, bouton « Ajouter au panier », bouton « Commander », badge promo | Fond de section, texte courant, plus de 2 éléments visibles simultanément |
| `--sapin` | Barre de navigation, boutons secondaires, en-têtes de tableau admin, footer | Grandes aplats de couleur |
| `--seve` | Badge « Bois sec », étoiles d'avis, filet décoratif du bloc signature | Boutons, liens |
| `--ecorce` | Sections récit, footer, admin | Fond du tunnel de commande |

**Une seule couleur accent, utilisée avec parcimonie.** Si l'écran contient trois éléments braise, il en contient deux de trop.

### 2.2 Contrastes vérifiés

| Combinaison | Ratio | Verdict |
|---|---|---|
| `--encre` sur `--aubier` | 15,2:1 | ✅ AAA |
| `--cendre` sur `--aubier` | 5,1:1 | ✅ AA |
| `--aubier` sur `--ecorce` | 14,8:1 | ✅ AAA |
| `--cendre-clair` sur `--ecorce` | 7,4:1 | ✅ AAA |
| Blanc sur `--braise` | 4,64:1 | ✅ AA (texte normal) |
| Blanc sur `--sapin` | 10,9:1 | ✅ AAA |
| `--braise` sur `--aubier` | 4,13:1 | ⚠️ **fonds et éléments non textuels uniquement** |
| `--braise-texte` sur `--aubier` | 5,47:1 | ✅ AA — **à utiliser pour tout texte accentué** |

Cette dernière ligne est une règle stricte : `--braise` remplit, `--braise-texte` écrit.

### 2.3 Thème white-label

Les tokens sont injectés depuis `company_themes.tokens` sous forme de custom properties dans un `<style>` du layout racine. **Changer d'entreprise = changer 6 valeurs hex + un logo.** Aucune classe Tailwind ne contient de couleur en dur : on utilise exclusivement `bg-[--sapin]`, `text-[--encre]`, etc., ou des utilitaires sémantiques déclarés dans `@theme`.

Un mode dégradé garantit que si `tokens` est vide, la palette ci-dessus s'applique par défaut.

---

## 3. Typographie

**Display : `Fraunces`** (variable, Google Fonts). Une old-style à empattements en coin, dotée d'axes `SOFT` et `WONK`. Ses empattements en biseau évoquent la fente et la hache sans jamais tomber dans le rustique. Elle est chaleureuse et sérieuse à la fois — exactement le registre recherché. Ce n'est ni Playfair (le défaut « luxe IA »), ni une manuscrite artisanale.

**Corps et interface : `Archivo`** (variable). Grotesque robuste, légèrement condensée, excellente en petites tailles, chiffres tabulaires disponibles. Elle tient les tableaux de l'admin comme les libellés du tunnel. Ce n'est pas Inter.

**Mono : `IBM Plex Mono`** — références de commande, SKU, montants dans l'admin uniquement.

```js
// tailwind @theme
fontFamily: {
  display: ['Fraunces', 'Georgia', 'serif'],
  sans:    ['Archivo', 'system-ui', 'sans-serif'],
  mono:    ['IBM Plex Mono', 'monospace'],
}
```

### 3.1 Échelle

| Rôle | Taille mobile / desktop | Police | Réglages |
|---|---|---|---|
| Hero | 40 / 76 px | Fraunces 600 | `opsz 96`, `SOFT 40`, `WONK 1`, `leading-[0.95]`, `tracking-[-0.02em]` |
| H1 page | 32 / 48 px | Fraunces 600 | `leading-[1.05]` |
| H2 section | 26 / 36 px | Fraunces 500 | |
| H3 | 20 / 24 px | Archivo 600 | |
| **Corps** | **17 / 17 px** | Archivo 400 | `leading-[1.65]`, `max-w-[68ch]` |
| Corps large (récit) | 19 / 20 px | Archivo 400 | |
| Libellé de champ | 15 px | Archivo 600 | jamais en dessous |
| Micro-label | 12 px | Archivo 600 | `uppercase tracking-[0.12em]` |
| **Prix** | 28 / 36 px | Fraunces 700 | chiffres tabulaires, couleur `--braise-texte` |
| Données admin | 14 px | Archivo 500 | `font-variant-numeric: tabular-nums` |

**Le corps de texte est à 17 px, pas 16.** C'est un choix assumé pour l'audience. Aucun texte lisible ne descend sous 14 px sur le site public.

`WONK 1` (les italiques « bancales » de Fraunces) est réservé **au seul titre du hero de l'accueil**. Une fois, nulle part ailleurs.

---

## 4. L'élément signature — « la règle de coupe »

C'est ce dont le site sera retenu, et c'est directement issu du métier.

Sur la fiche produit, le sélecteur de longueur n'est pas une liste déroulante ni des pastilles. C'est une **règle graduée en centimètres** au-dessus de laquelle sont dessinées les bûches **à l'échelle réelle relative** : la bûche de 50 cm fait exactement deux fois la longueur de celle de 25 cm à l'écran.

```
   25          33            40              50
  ┌──┐       ┌────┐       ┌──────┐       ┌────────┐
  │▓▓│       │▓▓▓▓│       │▓▓▓▓▓▓│       │▓▓▓▓▓▓▓▓│    ← section de bûche, cernes visibles
  └──┘       └────┘       └──────┘       └────────┘
 ─┴──┴────────┴────┴───────┴──────┴───────┴────────┴─   ← règle graduée
  ●
  Sélectionné : 33 cm — s'adapte à la majorité des poêles et inserts
```

**Pourquoi ça marche :**
- Ça résout un vrai problème d'achat : le client ne sait souvent pas quelle longueur entre dans son foyer. Voir les proportions le lui dit instantanément.
- Ça encode une information vraie, pas une décoration. Le skill `frontend-design` insiste sur ce point : les dispositifs structurels doivent porter du sens.
- C'est impossible à confondre avec un template.

**Implémentation :** SVG unique, largeur des bûches en pourcentage de `cut_length.cm / max_cm`, texture de cernes en `<pattern>`, sélection au clic ou au clavier (flèches gauche/droite), curseur qui glisse en 200 ms `cubic-bezier(0.2,0,0,1)`. Sous 400 px, la règle passe en défilement horizontal avec accroche (`scroll-snap`). Une version texte accessible (`<fieldset>` + `<legend>` + radios visuellement masqués) porte la sémantique réelle — le SVG n'est qu'une couche de présentation.

### 4.1 Élément signature secondaire — la jauge d'humidité

Quand `measured_humidity_pct` est renseigné, la fiche affiche une jauge horizontale segmentée avec la valeur mesurée pointée, la date de mesure et le lot. Trois segments : *sec ≤ 20 %*, *mi-sec 20-35 %*, *vert > 35 %*.

> **Humidité mesurée : 17 %** — lot de septembre 2026, mesuré au testeur le 12/09
> `[████████●░░░░░░░░░░░░░]`
> Prêt à brûler

Aucun concurrent ne publie une mesure datée. C'est une preuve, pas une promesse — et c'est l'argument qui justifie un prix supérieur.

---

## 5. Mise en page

- **Grille 12 colonnes**, gouttière 24 px, conteneur `max-w-[1240px]`, marge latérale mobile 20 px.
- **Échelle d'espacement** (densité 4/10, standard) : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px. Rien entre.
- **Rayons** : 4 px (champs, badges), 8 px (cartes), 0 px (sections plein écran). Pas de `rounded-full` sauf sur les avatars et les pastilles de statut.
- **Ombres** : une seule, très douce, réservée aux cartes produit au survol. Sur fond sombre, on utilise une bordure `--ecorce-bord` plutôt qu'une ombre.
- **Breakpoints** : 375 · 640 · 768 · 1024 · 1280 · 1440. Toute maquette est validée à 375 px d'abord.

---

## 6. Parcours et écrans clés

### 6.1 Accueil (sombre → clair)

1. **Hero** — photo plein écran d'un tas de bois fendu au petit matin, brume. Titre Fraunces sur deux lignes. Sous-titre d'une phrase avec la commune. **Un seul CTA braise** : « Commander mon bois ». Sous le CTA, trois preuves en micro-labels : *Livré sous 5 jours · Bois sec mesuré · Ardèche nord*. Aucun carrousel.
2. **Barre de réassurance** (clair) — 4 items : livraison, humidité mesurée, paiement à la livraison possible, entreprise locale.
3. **Les produits** (clair) — 3 à 4 cartes, prix visible, badge humidité, bouton direct.
4. **« Où livrons-nous ? »** (clair) — champ de saisie de code postal **directement dans la page d'accueil**. Réponse immédiate : « Oui, nous livrons Annonay — livraison le mardi et le jeudi, à partir de 12 € ». C'est la question n°1 du visiteur, elle est traitée en dessus de la ligne de flottaison.
5. **Le récit** (sombre) — 4 étapes de la forêt au bûcher, une photo par étape, texte court.
6. **Avis Google** (clair) — note globale + 3 avis récents.
7. **Guides** (clair) — 3 cartes.
8. **Footer** (sombre) — coordonnées, communes livrées, liens légaux.

### 6.2 Fiche produit

Ordre imposé sur mobile : galerie → nom → prix → **règle de coupe** → essence → humidité + jauge → quantité → **prix total en direct** → bouton → réassurance → description → livraison → avis.

Le prix total se met à jour **instantanément** au changement de quantité, avec le détail dépliable :
```
5 m³ apparents × 104,00 €        520,00 €
Livraison Annonay (18 km)         14,50 €
────────────────────────────────────────
Total TTC                        534,50 €
```

Un **bloc collant en bas d'écran sur mobile** garde le prix total et le bouton toujours visibles.

### 6.3 Tunnel — 4 étapes, jamais plus

```
1. Panier          → lignes, code postal, frais calculés, bouton "Imprimer le devis"
2. Coordonnées     → email, téléphone, adresse + contraintes d'accès
3. Créneau         → liste de dates, choix du créneau souhaité
4. Paiement        → modes filtrés, récapitulatif, CGV, payer
```

Règles :
- Barre de progression numérotée visible en permanence.
- **Aucune création de compte demandée.** Le champ mot de passe n'existe pas dans le tunnel.
- Un seul champ par ligne sur mobile, clavier adapté (`inputmode="numeric"` pour le code postal, `type="tel"`).
- Autocomplétion d'adresse (API Adresse gouvernementale, gratuite) avec saisie manuelle toujours possible.
- Le récapitulatif de commande est **replié** sur mobile, dépliable, et affiche toujours le total.
- Validation à la sortie du champ, message d'erreur sous le champ concerné, jamais uniquement en haut de page.
- Bouton final explicite : **« Payer 534,50 € »**, jamais « Valider ».

### 6.4 Compte client

Écran d'accueil du compte = **une seule chose au-dessus de la ligne de flottaison** : la dernière commande avec un bouton **« Recommander la même chose »**. Ce bouton pré-remplit le panier à l'identique et emmène directement à l'étape 3 (créneau), l'adresse étant déjà connue. Deux clics, trente secondes. C'est la fonctionnalité la plus rentable du site pour une clientèle qui rachète chaque année.

---

## 7. Mouvement

Niveau **standard, 5/10**. Le mouvement sert la compréhension, jamais le spectacle.

| Élément | Animation | Durée / easing |
|---|---|---|
| Apparition des cartes produit | fondu + translation Y de 12 px, décalage 60 ms | 320 ms · `cubic-bezier(0.2,0,0,1)` |
| Sélecteur règle de coupe | glissement du curseur | 200 ms |
| Ajout au panier | badge du panier qui pulse une fois + toast | 240 ms |
| Prix qui change | compteur qui roule sur 2 chiffres max | 300 ms |
| Hero à l'arrivée | photo qui se révèle par un masque montant, titre en décalé | 700 ms, une seule fois |
| Survol de carte | translation Y de 2 px + ombre | 180 ms |

**`prefers-reduced-motion: reduce` supprime tout** sauf les changements d'opacité instantanés. Aucune animation ne dépasse 700 ms. Aucune animation de `width`/`height` — `transform` et `opacity` uniquement.

GSAP n'est chargé que sur les pages du registre récit, en import dynamique. Le tunnel n'a aucune dépendance d'animation.

---

## 8. Iconographie

**Lucide**, trait 1,75 px, taille 20 px (24 px pour la navigation). Aucun emoji, nulle part, y compris dans l'admin et les emails.

Trois icônes sur mesure sont dessinées pour le projet, parce qu'elles n'existent nulle part et qu'elles portent l'identité : **section de bûche avec cernes**, **stère empilé**, **camion benne**. Elles servent respectivement au sélecteur de longueur, au sélecteur de quantité et au bloc livraison.

---

## 9. Qualité — checklist de pré-livraison

Reprise du skill `ui-ux-pro-max`, applicable à **chaque écran** avant validation :

- [ ] Contraste ≥ 4,5:1 pour tout texte, ≥ 3:1 pour les éléments d'interface
- [ ] Cibles tactiles ≥ 44 × 44 px, espacées d'au moins 8 px
- [ ] Focus clavier **visible** partout — anneau `--braise` 2 px, décalé de 2 px. Jamais `outline: none` sans remplacement
- [ ] Navigation complète au clavier, ordre de tabulation logique, lien d'évitement en tête de page
- [ ] Tout champ a un `<label>` **visible** — le placeholder n'est jamais le seul libellé
- [ ] Erreurs affichées sous le champ + `aria-live="polite"` + résumé en tête de formulaire
- [ ] Toute image a un `alt` — décoratives en `alt=""`
- [ ] Dimensions réservées pour images et vidéos → **CLS < 0,1**
- [ ] Trois états présents : chargement (squelette, pas de spinner seul), vide (avec action), erreur (avec recours)
- [ ] Aucune information portée par la couleur seule (statuts = couleur **et** libellé)
- [ ] `cursor: pointer` sur tout élément cliquable
- [ ] Testé à 375, 768, 1024, 1440 px — aucun défilement horizontal
- [ ] `prefers-reduced-motion` respecté
- [ ] Zoom navigateur jusqu'à 200 % sans perte de fonction
- [ ] Aucun emoji utilisé comme icône

**Objectifs Lighthouse en production :** Performance ≥ 92 mobile · Accessibilité 100 · SEO 100 · LCP < 2,0 s · INP < 200 ms.

---

## 9 bis. shadcn/ui — intégration et écarts assumés

Installé avec les primitives **Radix** (`components.json`, `-b radix`), variables CSS activées, curseur main sur les boutons.

### Principe d'intégration

Les variables sémantiques de shadcn **n'ont aucune valeur propre** : elles pointent vers la palette bois définie en §2.

```
--primary     → --sapin        --accent      → --braise
--background  → --aubier       --destructive → --erreur
--card        → --aubier-pur   --ring        → --braise
--muted-foreground → --cendre  --border      → --aubier-bord
```

Conséquence : **tout composant shadcn ajouté au projet est automatiquement à la charte**, et le thème white-label (`company_themes.tokens`) le repeint sans qu'on y touche. La classe `.dark` est mappée sur le registre écorce et sert à l'**administration** — ce n'est pas un mode sombre commutable par préférence système (§1, §10).

### ⚠️ Fichiers modifiés à la main — ne pas régénérer sans réappliquer

`shadcn add <composant> --overwrite` **écrase** ces fichiers. Chacun porte un commentaire d'avertissement en tête.

| Fichier | Écart | Raison |
|---|---|---|
| `ui/button.tsx` | Tailles portées de **h-8 (32 px) à h-11 (44 px)** par défaut ; ajout d'un variant **`cta`** (braise, h-14) | 32 px est très en dessous du plancher tactile de 44 px. Audience 55+, sur téléphone, souvent avec des mains de travail |
| `ui/input.tsx` | h-8 → **h-12** ; `md:text-sm` **supprimé**, taille fixée à 17 px ; rayon 4 px | Le défaut *réduisait* le texte sur grand écran — l'inverse du besoin. Un tunnel de commande illisible ne convertit pas |
| `ui/textarea.tsx` | Idem input, `min-h-24` | Cohérence des champs |
| `ui/label.tsx` | `text-sm` → **15 px semi-gras** | Le design system interdit un libellé de champ sous 15 px : le placeholder ne remplace jamais un label |

La taille `sm` (36 px) subsiste, **réservée aux tableaux denses de l'administration**. Elle ne doit jamais apparaître sur le site public.

### Piège rencontré à l'installation

`shadcn init` a ajouté la police **Geist** et redéfini `--font-sans`, écrasant Archivo, puis posé une palette de gris neutres en `oklch`. Les deux ont été annulés. Si une future commande `shadcn` réintroduit Geist dans `layout.tsx`, la retirer.

---

## 10. Ce qu'on ne fait pas

Liste explicite pour éviter la dérive « site moderne générique » :

- Pas de carrousel de hero, pas de vidéo en autoplay avec son.
- Pas de compte à rebours factice ni de « 3 personnes regardent ce produit ».
- Pas de chatbot.
- Pas de pop-up d'inscription newsletter à l'arrivée.
- Pas de mode sombre commutable sur le site public — le registre est fixé par la page, pas par une préférence.
- Pas d'effet parallaxe dans le tunnel de commande.
- Pas de dégradés multicolores, pas de glassmorphism, pas de néon.
- Pas de texte sur photo sans voile de lisibilité contrôlé.
