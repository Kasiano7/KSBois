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

### 6.4 Compte client — ✅ fait

Écran d'accueil du compte = **une seule chose au-dessus de la ligne de flottaison** : la dernière commande avec un bouton **« Recommander la même chose »**. Ce bouton pré-remplit le panier à l'identique et emmène directement à l'étape 3 (créneau), l'adresse étant déjà connue. Deux clics, trente secondes. C'est la fonctionnalité la plus rentable du site pour une clientèle qui rachète chaque année.

**Décisions prises à l'implémentation :**

| Sujet | Choix retenu | Pourquoi |
|---|---|---|
| Connexion | `/compte/connexion`, **lien magique uniquement**, distinct de `/connexion` (entreprise) | Aucun mot de passe pour cette audience ; et un lien de connexion client ne doit jamais servir de tremplin vers l'administration |
| Création de compte | `shouldCreateUser: true` côté client, `false` côté entreprise | L'accès à l'administration se mérite par une ligne dans `company_members` ; l'espace client s'ouvre à qui possède l'adresse email |
| Historique invité | Rattaché automatiquement à la première connexion, sur l'email **vérifié par Supabase Auth** | Sans cela, un client qui a commandé sans compte ouvre un espace vide. Et se fier à une adresse saisie permettrait de réclamer les commandes d'un tiers |
| Deux clics | Recommande → **étape créneau directement**, panier et coordonnées pré-remplis | C'est la promesse. Le créneau est la seule chose qui ne peut pas être reprise |
| Sauf si quelque chose a changé | Format retiré, prix révisé, quantité ajustée, stock insuffisant → **on affiche ce qui a bougé et on renvoie au panier** | Un client qui découvre au paiement qu'il ne commande pas ce qu'il croyait ne revient pas |
| Comparaison de prix | Sur le prix **réellement applicable**, palier dégressif de la quantité compris | Comparer les prix de base taisait une hausse réelle et annonçait « inchangé » à quelqu'un qui allait payer 35 € de moins |
| Mes adresses | Reconstituées depuis les commandes passées, en lecture | La table `addresses` n'est alimentée par aucun parcours à ce jour : afficher un carnet d'adresses modifiable serait mentir sur ce que le site sait faire |
| Dates | Année affichée sur tout l'historique | « Livrée le 18 novembre » ne dit pas de quel hiver on parle |

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

## 9 ter. Accueil — maquette client du 9 août 2026

La marque de l'en-tête public (lien de retour à l'accueil) est pilotée par les réglages :
`companies.name`, `branding.tagline` et `branding.logo_url`. Sans logo configuré, l'icône sapin
reste le repli accessible. Le changement est commun aux deux variantes de l'en-tête.

Le client a fourni une maquette de l'accueil. Elle a été suivie pour la **mise en page** ; les écarts ci-dessous sont assumés et datés.

**Repris de la maquette :**

- En-tête en surimpression du héros : marque à gauche, navigation, icônes compte et panier (avec pastille de comptage), bouton « Commander mon bois » cerclé.
- Héros plein cadre sombre, titre display sur deux à trois lignes, sous-titre court, puis **trois preuves** avec icônes cerclées séparées par des filets.
- **Configurateur en une seule grande carte claire qui chevauche le bas du héros**, en trois volets : longueur · type de bois · « Votre sélection ». Le cœur transactionnel est ainsi visible sans défiler.
- Essence sélectionnée en **carte pleine sombre** (le sélecteur de longueur garde, lui, le cadre clair et sa pastille radio — la maquette distingue elle aussi les deux gestes).
- Bandeau d'estimation de livraison à icône cerclée, puis bandeau de réassurance à quatre entrées.

**Écarts assumés :**

| Point | Décision | Raison |
|---|---|---|
| Bouton « Valider ma sélection » en `--seve` | **Accepté**, contre la règle §2.1 qui réserve la sève aux badges et les CTA à la braise | Demande explicite du client sur la maquette. La braise reste l'accent du prix : l'écran ne porte donc pas deux accents concurrents |
| Texte du bouton or | `--encre`, pas blanc | Blanc sur sève ne donne que 2:1 de contraste. Encre sur sève dépasse 9:1 et reste fidèle au visuel |
| Fond du héros | Photo fournie par le client, servie en local par `next/image` | ImageKit n'est toujours pas ouvert : l'image vit dans `src/assets/`. À basculer sur ImageKit quand le compte existera (`docs/04`) |
| État sélectionné, partout | Vert sapin : carte pleine sur l'accueil, cadre `--sapin` + fond `sapin/8` dans le tunnel (créneau, paiement) | L'orange ne marque plus jamais une sélection. Un seul idiome sur tout le parcours, au lieu de deux |
| Navigation | Trois liens (« Bois de chauffage », « Livraison », « Devis sur mesure ») au lieu des six de la maquette | « À propos », « Conseils » et « Contact » n'existent pas encore. Un lien mort vaut moins qu'un menu court (docs/05 §1) |
| Textes et chiffres | Ceux du site, pas ceux de la maquette | La maquette est une image générée : elle écrit « m² » au lieu de m³ apparents, « Esseness sfiectionnées », et un prix inventé de 125 €. L'unité légale et les prix réels priment (`PLAN.md` §3.1) |
| Deux boutons d'ajout | Conservés (« Ajouter au panier » près du produit, « Valider ma sélection » dans le récapitulatif) | Conformes à la maquette, et les deux appellent **la même** fonction : aucune divergence possible |

**Généralisation au registre public (fait).** Les routes publiques vivent désormais dans le groupe `(site)` — `page.tsx`, `panier`, `commande`, `devis`, `compte`, `connexion` — dont le layout appose l'en-tête. Le groupe n'ajoute aucun segment d'URL : les chemins sont inchangés.

L'en-tête a deux variantes, et **la marque ramène toujours à l'accueil** : c'est la sortie de secours d'une audience qui n'utilise pas le bouton « précédent ».

| Variante | Où | Rendu |
|---|---|---|
| `surimpression` | accueil | posée sur la photo, sans fond |
| `pleine` | toutes les autres pages publiques | barre écorce collante en haut |

⚠️ **Un layout ne reçoit pas le chemin demandé.** `src/proxy.ts` le dépose dans l'en-tête `x-chemin`, que le layout lit pour choisir la variante. Sans ce détour, il aurait fallu dupliquer le layout dans deux groupes de routes imbriqués.

**Photo du héros (fait).** `src/assets/heros-bucheron.png` (1672 × 941), servie par `next/image` avec `priority` et `placeholder="blur"`.

⚠️ **Le héros n'utilise PAS `object-cover` sur grand écran, et c'est le point central.** `cover` dimensionne sur le plus contraignant des deux axes : sur une photo panoramique posée dans un bandeau large et court, la largeur pilote tant que la fenêtre est très large, puis **la hauteur reprend la main dès qu'elle se resserre**. Mesuré avant correction : facteur d'échelle 1,22 à 2048 px contre 0,88 à 1265 px, soit un bûcheron 40 % plus gros d'une résolution à l'autre.

La règle retenue : **on pilote la largeur seule**, entre deux bornes rapprochées (`w-[clamp(1500px,100vw,1620px)]`), la hauteur suit le ratio naturel, et l'image est ancrée en haut à droite. Conséquence assumée et souhaitable : sur un écran très large, la photo ne touche pas le bord gauche et l'on voit du fond sombre — **mieux vaut du fond que du zoom**. Le voile étant opaque de ce côté, la jonction ne se voit pas.

| Fenêtre | Hauteur du héros | Image rendue | Échelle |
|---|---|---|---|
| 1280 × 800 | 805 px | 1500 × 844 | 0,897 |
| 1366 × 768 | 805 px | 1500 × 844 | 0,897 |
| 1440 × 900 | 805 px | 1500 × 844 | 0,897 |
| 1920 × 1080 | 805 px | 1620 × 912 | 0,969 |
| 2048 × 858 | 805 px | 1620 × 912 | 0,969 |

Écart résiduel : 8 %. Sur téléphone, `cover` reste le bon choix — le bandeau est alors plus haut que large et il n'y a pas de composition à préserver.

Deux voiles de lisibilité, et c'est volontaire : uniforme sur téléphone où le texte occupe toute la largeur, dégradé de gauche à droite sur grand écran où le texte tient à gauche et où le bûcheron doit rester visible à droite.

**En-tête collante — une exception.** La barre est `sticky` partout SAUF dans l'espace client, qui porte sa propre barre de navigation : au premier défilement, l'en-tête passait par-dessus et rendait « Mes commandes », « Mes adresses » et « Se déconnecter » inatteignables. Un décalage fixe (`top-[92px]`) aurait été faux dès que l'en-tête passe sur deux lignes ; on coupe donc la stickiness via la prop `collante`. Toute page qui ajoutera une sous-navigation devra faire de même.

**Bouton or, variante `or`.** L'écart de charte est porté par une variante de bouton dédiée (`src/components/ui/button.tsx`) et non par des classes en ligne, pour qu'il reste réversible en un seul endroit. Elle est **réservée au registre public** — l'administration garde `cta` en braise.

**Piège d'alignement rencontré.** Les trois volets du configurateur démarraient en escalier : une `<legend>` s'ancre sur la bordure de son `<fieldset>` et **ignore son `padding-top`**. Le padding doit donc être porté par un `<div>` englobant, jamais par le `fieldset` lui-même. Les trois titres partagent en outre la même boîte (`flex h-8 items-center`, 19 px, semi-gras).

---

## 9 quater. Administration — refonte du 10 août 2026 (vert sapin et graphiques)

Le client a fourni un visuel de l'administration : **sidebar et fond en vert très sombre**, cartes à grand rayon, tuiles d'indicateurs à courbe, anneau de répartition, jauge circulaire, barres classées. La refonte suit ce visuel. Le §1 disait « l'admin est un troisième registre : sombre, dense » — la teinte change, le principe ne change pas.

### La bascule tient dans une classe

`src/app/admin/layout.tsx` pose `registre-admin` sur le conteneur racine. Cette classe (`globals.css`) **redéfinit trois tokens de surface** :

| Token | Avant (écorce) | Après (sapin) | Rôle |
|---|---|---|---|
| `--ecorce` | `#171310` | `#0e1e16` | fond de l'administration |
| `--ecorce-eleve` | `#241d18` | `#15291f` | cartes |
| `--ecorce-bord` | `#352c24` | `#2a4a38` | bordures |
| `--cendre-clair` | `#a79c8e` | `#a3b7ab` | texte secondaire, teinté vert |

**Les dix écrans existants n'ont pas été touchés** : ils n'utilisent que ces tokens, donc ils se repeignent seuls. Retirer la classe suffit à revenir au brun. C'est aussi ce qui garde le thème white-label intact.

⚠️ **`--primary` doit être surchargé, et c'est le piège du jour.** `.dark` le mappe sur `--sapin-clair` (`#2E4C3A`) : posé sur un fond vert sombre, le rapport tombe à **1,0:1** — le bouton principal devenait littéralement invisible. Il est donc redéfini à `#3f7a5b`.

### Contrastes vérifiés (registre admin)

| Combinaison | Ratio | Verdict |
|---|---|---|
| `--aubier` sur fond `#0e1e16` | 15,4:1 | ✅ AAA |
| `--aubier` sur carte `#15291f` | 13,7:1 | ✅ AAA |
| `--cendre-clair` `#a3b7ab` sur carte | 7,2:1 | ✅ AAA |
| `--primary` `#3f7a5b` sur fond | 3,4:1 | ✅ élément d'interface |
| Blanc sur `--primary` | 5,1:1 | ✅ AA |
| `--graphique-1` (sève) sur carte | 8,4:1 | ✅ AAA |
| `--graphique-2` `#7fbf9a` sur carte | 7,2:1 | ✅ AAA |
| `--graphique-3` `#e2703a` sur carte | 4,8:1 | ✅ AA |
| `--graphique-4` `#6fa8c9` sur carte | 5,9:1 | ✅ AA |
| `--seve` + `--encre` (onglet actif) | 9,3:1 | ✅ AAA |

### Navigation

Dix liens à plat obligeaient à relire la liste entière. Ils sont **groupés** en Pilotage · Ventes · Livraison · Entreprise, avec l'écran courant en pastille sève. Sur mobile, une seule rangée qui défile, sans titres de groupe. `src/components/admin/navigation-admin.tsx` est le **seul composant client** de la coquille, et uniquement pour lire `usePathname()`.

L'écran actif est celui dont le chemin correspondant est **le plus long** : sinon `/admin` reste allumé partout.

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


---

## 11. Graphiques de l'administration

### Pourquoi du SVG écrit à la main, sans bibliothèque

Recharts, Chart.js et consorts imposent un composant client et 40 à 120 ko de JavaScript pour tracer cinq polylignes. Trois raisons de s'en passer :

1. L'objectif de performance (§9) ne le supporte pas, et l'administration se consulte depuis une cabine de camion, en 4G.
2. Leur thème par défaut est étranger à la charte, et `company_themes.tokens` ne les repeindrait pas.
3. Un SVG rendu côté serveur **s'imprime**. L'exploitant imprime ses tournées ; il imprimera ses courbes.

Tous les composants de `src/components/admin/graphiques/` sont donc des **composants serveur**, sans une ligne de JS envoyée au navigateur. La géométrie pure est dans `src/lib/graphiques.ts`, testée (`tests/unit/graphiques.test.ts`).

| Composant | Quand l'utiliser | Interdit |
|---|---|---|
| `Courbe` | Une grandeur dans le temps, une série + la période précédente | Trois séries ou plus : on ne compare plus, on décore |
| `Sparkline` | Tendance dans une tuile d'indicateur | Seule porteuse d'un chiffre — le nombre est au-dessus, en grand |
| `Anneau` | Répartition en 5 parts maximum | Une répartition à deux décimales près |
| `BarresClassees` | Un classement (essences, formats, motifs de perte) | Une série temporelle |
| `Jauge` | Un taux qui a un sens sur 0-100 % | Un montant, un volume |

### Règles communes

- **La couleur ne porte jamais l'information seule.** Chaque part d'anneau écrit son pourcentage, chaque jauge écrit son verdict (« Très bon », « À surveiller »), chaque barre écrit sa valeur.
- **Chaque courbe est doublée d'un `<table class="sr-only">`** qui contient la donnée exacte, point par point.
- **Infobulles = `<title>` SVG natifs.** Zéro JavaScript, et elles fonctionnent au clavier via le survol du lecteur.
- **Les montants d'axe sont abrégés** (`formatEurosCompact` : « 1,9 k€ »), jamais les montants réels. Un prix, un total ou une facture s'écrit en entier.
- **Le pas de temps est déduit de la durée affichée** (`choisirGranularite` : jour ≤ 45 j, semaine ≤ 200 j, mois au-delà) et **écrit sous le graphique**. Les seaux vides valent zéro et ne sont jamais omis : une semaine sans vente est une information.

### Quatre pièges payés à l'implémentation

1. **`preserveAspectRatio="none"` déforme tout ce qui est dans le SVG.** Le repère est étiré horizontalement pour occuper la largeur : les `<text>` y sont écrasés et les `<circle>` deviennent des ellipses. La règle retenue : **aucun texte ni cercle dans le SVG**. Les étiquettes d'axe et les marqueurs de fin sont en HTML, positionnés en pourcentage pour l'axe X. La hauteur du `viewBox` est **égale à la hauteur CSS**, ce qui rend l'axe vertical exact au pixel et permet de poser les graduations sur les mêmes ordonnées que les lignes de grille.

2. **`sr-only` ne rétrécit pas un `<table>`.** Une table CSS traite `width: 1px` comme un **minimum** et refuse de descendre en dessous de son contenu. Posée directement sur le tableau de données, la classe le laissait occuper 500 px en position absolue : la page défilait horizontalement — invisible à l'œil, mais bien réel, et interdit par §9. La classe est portée par un `<div>` englobant.

3. **Un lissage de courbe classique dépasse les données.** Une conversion Catmull-Rom → Bézier faisait plonger la courbe de chiffre d'affaires **sous zéro** entre une journée à 0 € et une journée à 900 €. Les points de contrôle sont désormais bornés verticalement au segment. Une courbe d'argent ne doit jamais montrer une valeur que le tableau ne contient pas.

4. **Le plafond d'axe doit être calculé, pas atteint par une boucle.** Graduer « tant que la valeur ≤ maximum » tronquait l'axe sous la donnée : 3 214 € donnait un axe qui s'arrêtait à 3 000 € et la courbe sortait du cadre. Le nombre de crans se déduit du plafond arrondi, jamais l'inverse.

Deux réglages de lisibilité mesurés au navigateur : une étiquette d'axe sur sept au maximum, et **une sur deux seulement sous 640 px** (« 11 juil. » et « 16 juil. » se chevauchaient sur téléphone), en filtrant depuis la fin pour toujours conserver la date la plus récente.

### Voir les écrans avec des données

La base de départ ne contient **aucune commande** : le tableau de bord et les statistiques s'affichaient à zéro, et rien n'y était vérifiable. `supabase/demo/statistiques.sql` génère 14 mois d'historique saisonnier (≈ 970 commandes, devis, sessions et événements de parcours) :

```bash
npm run db:demo
```

Il est idempotent, volontairement **hors** du glob `./seeds/*.sql` — il ne part donc jamais vers un environnement hébergé par inadvertance — et ne mouvemente aucun stock : ce sont des commandes d'historique, pas des réservations.

---
