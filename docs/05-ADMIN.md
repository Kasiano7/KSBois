# 05 — Administration

> **Contrainte de conception dominante : l'exploitant n'est pas à l'aise avec l'informatique.** Chaque écran est jugé sur un critère unique — *une personne qui n'a jamais vu l'outil peut-elle accomplir la tâche sans aide ?* Si la réponse est non, l'écran est refait, pas documenté.

---

## 1. Principes d'interface admin

1. **Des mots, pas des icônes seules.** Chaque bouton porte un libellé écrit. Les icônes accompagnent, jamais ne remplacent.
2. **Une action principale par écran**, visible sans défilement, en `--braise`.
3. **Pas de jargon.** « Variante » devient « Format », « SKU » devient « Référence », « Statut » reste « Statut » mais avec des libellés en français courant.
4. **Confirmation explicite** pour toute action destructive, avec le nom de l'objet affiché en toutes lettres dans la boîte de dialogue.
5. **Sauvegarde immédiate** sur les champs simples (stock, prix, statut), avec retour visuel « Enregistré ». Formulaire complet uniquement pour la création.
6. **Rien ne se supprime vraiment.** Produits et clients se désactivent. La suppression définitive est réservée au rôle `owner` et journalisée.
7. **Chaque écran fonctionne sur téléphone.** L'exploitant consultera ses commandes depuis le camion.
8. **Toute donnée modifiable depuis l'admin.** Aucun réglage n'exige une intervention développeur — c'est la condition du modèle white-label.

---

## 2. Dashboard `/admin`

Structure en trois blocs, du plus urgent au plus contextuel.

### Bloc 1 — Aujourd'hui (le plus grand, en haut)

```
┌─────────────────────────────────────────────────────────┐
│  MARDI 14 OCTOBRE                                        │
│                                                          │
│   6            18 m³         1 840 €         3           │
│   livraisons   à charger     à encaisser     nouvelles   │
│                              dont 620 € esp. commandes   │
│                                                          │
│   [ Ouvrir la tournée du jour ]                          │
└─────────────────────────────────────────────────────────┘
```

Le montant en espèces est isolé : c'est ce que le livreur doit rapporter le soir.

### Bloc 2 — Ce qui demande une action

Liste, pas des compteurs. Chaque ligne est cliquable et mène à l'écran de traitement.

- 2 commandes à confirmer (créneau non confirmé)
- 1 demande de devis en attente depuis 2 jours
- 1 virement attendu depuis 6 jours — CMD-2026-0138
- ⚠️ 2 produits sous le seuil de stock : Chêne 33 cm (3 m³), Allumage (0)

### Bloc 3 — Activité

- Chiffre d'affaires du mois vs mois précédent (courbe simple)
- Commandes du mois
- Volume vendu en m³
- Prochaines livraisons (7 jours) : mini-calendrier avec charge par créneau

**Ce qui n'est pas sur le dashboard :** taux de conversion, sources de trafic, panier moyen. Ces données vont dans `/admin/statistiques`. Le dashboard répond à *« que dois-je faire aujourd'hui ? »*, rien d'autre.

---

## 3. Tournée du jour `/admin/tournee` — l'écran le plus utilisé

Sélecteur de date en haut. Vue liste, optimisée pour l'impression **et** pour le téléphone.

```
LIVRAISONS DU MARDI 14 OCTOBRE — Camion benne 19T — 18 m³
────────────────────────────────────────────────────────────
 1 ⣿  Jean DUPONT                              CMD-2026-0141
      3 m³ apparents · Chêne/Hêtre · 33 cm · sec
      Le Villard, 07690 Villevocance          [ Itinéraire ▾ ]
      06 12 34 56 78                          [ Appeler ]
      💳 Payé en ligne
      ⚠ Chemin étroit — pas de semi. Décharger devant le portail.
      [ Marquer comme livrée ]
────────────────────────────────────────────────────────────
 2 ⣿  Pierre MARTIN                            CMD-2026-0139
      5 m³ apparents · Chêne · 50 cm · mi-sec
      42 route de Boulieu, 07100 Annonay       [ Itinéraire ▾ ]
      06 98 76 54 32                          [ Appeler ]
      💶 ESPÈCES À ENCAISSER — 520 €
      ⚠ Absent — autorisé à décharger devant le garage
      [ Marquer comme livrée ]
────────────────────────────────────────────────────────────
```

### 3.1 Fonctions

| Fonction | Détail |
|---|---|
| Réordonnancement | Glisser-déposer par la poignée `⣿`. L'ordre est enregistré immédiatement |
| Itinéraire | Menu déroulant : **Google Maps · Waze · Apple Plans** — liens `geo:`/`https://` construits depuis les coordonnées, avec l'adresse en secours |
| **Tournée complète** | Bouton unique en haut : ouvre Google Maps avec **tous les arrêts en multi-étapes** dans l'ordre affiché |
| Appeler | Lien `tel:` direct |
| Marquer comme livrée | Passe le statut, décrémente le stock, demande la saisie du paiement si mode différé |
| Impression | Feuille A4 propre, une commande par bloc, cases à cocher, place pour la signature client |
| Total tournée | Volume cumulé et alerte si dépassement de la capacité du véhicule |

### 3.2 Signalements visuels

Le mode de paiement et les contraintes d'accès sont les deux informations qui font échouer une livraison. Ils sont donc affichés **en couleur et en toutes lettres**, jamais sous forme d'icône seule :

- `💶 ESPÈCES À ENCAISSER — 520 €` en `--braise`, gras
- `⚠ Contrainte d'accès` en `--alerte`, sur fond teinté
- `Reste à payer : 320 €` si acompte versé

### 3.3 Vue livreur `/livreur`

Version mobile épurée du même écran, accessible au rôle `driver` : uniquement la tournée du jour, en très gros caractères, avec trois actions par arrêt (itinéraire, appeler, livrée). Aucune donnée financière globale, aucun accès au reste de l'admin.

Fonctionnement hors ligne : **Lot 3**. En V1, un avertissement clair s'affiche en cas de perte de réseau, et la feuille imprimée reste le filet de sécurité.

### 3.4 Optimisation automatique — Lot 2

Bouton « Optimiser l'ordre ». Algorithme : matrice de distances via OSRM (auto-hébergeable, gratuit) ou OpenRouteService, résolution par heuristique du plus proche voisin puis amélioration 2-opt. Sur 6 à 10 arrêts, cette approche donne un résultat quasi optimal en quelques millisecondes.

**L'ordre proposé n'est jamais imposé** : il pré-remplit la liste, l'exploitant garde la main. Il connaît des contraintes que l'algorithme ignore (client absent avant 10 h, route en travaux).

---

## 4. Commandes `/admin/commandes`

**Liste :** filtres par statut (onglets avec compteurs), recherche par nom/référence/téléphone/commune, tri par date de livraison. Colonnes : référence, client, volume, montant, paiement, statut, date de livraison.

**Fiche commande :** trois colonnes sur desktop, empilées sur mobile.

1. **Contenu** — lignes, volumes, prix, options, remise, frais de livraison détaillés (base + volume + carburant), totaux, ventilation TVA.
2. **Client & livraison** — coordonnées, adresse, contraintes d'accès, créneau souhaité, créneau confirmé, notes client et notes internes.
3. **Actions & suivi** — changement de statut (boutons explicites : « Marquer prête », « Confirmer la date »), enregistrement d'un paiement, génération de facture, historique complet horodaté, envoi d'email manuel.

**Actions clés :**
- **Confirmer la livraison** — ouvre un sélecteur date + créneau, envoie automatiquement l'email et le SMS de confirmation.
- **Modifier la commande** — ajout/retrait de lignes, recalcul complet, diff affiché avant validation.
- **Créer une commande** — même formulaire, en mode saisie. Recherche client par téléphone ou email, création à la volée, tous les modes de paiement disponibles y compris « à régler plus tard ». Cet écran doit être utilisable **pendant** un appel téléphonique : recherche instantanée, aucun champ obligatoire superflu.

---

## 5. Produits et stock

### 5.1 `/admin/produits`

Liste avec vignette, nom, nombre de formats, prix de départ, stock total, état. Édition en ligne du prix et de l'état.

**Fiche produit :** onglets *Informations · Formats · Photos · SEO*.

L'onglet **Formats** est un tableau où chaque ligne est une variante :

| Référence | Longueur | Séchage | Cond. | Prix | Paliers | Stock | Seuil | Actif |
|---|---|---|---|---|---|---|---|---|

Édition directe dans le tableau, bouton « Dupliquer ce format » pour créer rapidement les déclinaisons de longueur. La création d'un produit propose un **assistant en 3 écrans** (essence → longueurs → prix) qui génère toutes les variantes d'un coup : c'est ce qui évite 20 saisies manuelles au démarrage.

### 5.2 `/admin/stock`

L'écran conçu pour être utilisé depuis le téléphone, en fin de journée.

```
┌──────────────────────────────────────────────────────┐
│  Chêne/Hêtre 33 cm — sec                              │
│  Disponible : 37 m³    Réservé : 5 m³   Total : 42 m³ │
│  [ + Ajouter ]  [ Corriger ]                          │
└──────────────────────────────────────────────────────┘
```

« Ajouter » ouvre un pavé numérique : *« Combien avez-vous produit ? »* → `+5` → enregistré. Deux gestes.
« Corriger » demande la quantité réelle et un motif (liste courte : inventaire, perte, erreur de saisie).

L'historique des mouvements est consultable mais n'encombre pas l'écran principal.

---

## 6. Livraison

### 6.1 `/admin/livraison/zones`

Deux vues du même objet.

**Vue Zones** — cartes de zones avec tarif de base, tarif au m³, seuil de gratuité, minimum de commande, jours de livraison, nombre de communes rattachées.

**Vue Communes** — le tableau de travail. Recherche, tri, sélection multiple, affectation en masse.

| Commune | CP | Distance | Zone | Jours | Livrée |
|---|---|---|---|---|---|
| Annonay | 07100 | 18 km | Zone B ▾ | Ma, Je | ✓ |
| Villevocance | 07690 | 2 km | Zone A ▾ | Tous | ✓ |
| Saint-Julien-Molin-Molette | 42220 | 24 km | Zone C ▾ | Je | ✓ |
| Privas | 07000 | 62 km | — | — | ✗ |

Un bouton **« Tester une adresse »** est présent en haut : on saisit un code postal et un volume, l'écran affiche le résultat exact que verrait un client (zone, véhicule retenu, détail des frais, jours disponibles). C'est l'outil qui donne confiance à l'exploitant dans le système.

**Panneau « Communes autour du dépôt »** — c'est lui qui remplit la vue Communes, et non la saisie manuelle (moteur : docs/02 §2.1).

L'exploitant saisit un rayon en **kilomètres de route** et clique sur *Analyser le secteur*. L'écran propose alors la liste des communes officielles à portée, avec leur distance routière mesurée et une zone déduite de la distance. Rien n'est écrit avant que l'exploitant n'ait relu la liste et cliqué sur *Importer* : l'analyse et l'import sont deux gestes distincts.

Ce que l'écran doit dire, et qu'il serait tentant de taire :

| Situation | Affichage |
|---|---|
| Commune déjà connue | « déjà dans votre liste », zone actuelle **conservée** |
| Distance de repli (routeur muet) | mention « estimée », en `--alerte`, jusque dans le tableau des communes |
| Commune proche à vol d'oiseau mais loin par la route | comptée et annoncée (« 104 communes écartées ») |
| Commune desservie hors du nouveau rayon | listée, **jamais supprimée** |

Un import ne défait jamais un réglage : distance saisie à la main, rattachement de zone et communes volontairement fermées sont préservés. Sans cette garantie, personne ne relancerait un scan après six mois d'ajustements.

### 6.2 `/admin/livraison/creneaux` — ✅ fait

Gestion des modèles récurrents (jour, horaires, capacité en nombre **et** en volume, véhicule, zones concernées) et calendrier des 8 prochaines semaines avec le taux de remplissage de chaque créneau (`4/8 livraisons · 12/20 m³`).

Clic sur un jour → fermer, modifier la capacité ponctuellement, ajouter un créneau exceptionnel. Bouton « Bloquer une période » pour les congés.

**Décisions prises à l'implémentation** — à ne pas défaire sans raison :

| Sujet | Choix retenu | Pourquoi |
|---|---|---|
| Vocabulaire | « Vos journées de livraison », jamais « modèle » ni « template » | L'exploitant règle ses jours de travail, pas des gabarits |
| Modification d'un modèle | **Ne touche pas** aux dates déjà générées, et l'écran le dit | Une commande réservée ne doit pas voir sa capacité changer sous elle |
| Chevauchement d'horaires | Refusé, avec le nom du créneau en conflit | La contrainte d'unicité en base ne rattrape que les doublons exacts : « 8h–12h » puis « 10h–14h » vendrait deux fois la même demi-journée |
| Baisse de capacité | Refusée sous le déjà réservé, message chiffré | Sinon le créneau s'afficherait « complet » alors que des livraisons y sont engagées |
| Désactiver une journée | Ferme les dates futures **encore vides**, laisse ouvertes celles qui portent des livraisons | Désactiver un jour de travail n'annule pas une livraison promise |
| Bloquer une période | Ferme réellement les créneaux existants (`delivery_slots.closed_by_blackout_id`) et signale les livraisons déjà prévues à replanifier | Le moteur de disponibilité écarte les dates bloquées côté client, mais `book_slot()` ne regarde que `is_open` — et l'exploitant verrait ses congés encore ouverts dans son propre calendrier |
| Annuler une fermeture | Rouvre **exactement** les créneaux que cette fermeture avait fermés | Un créneau fermé pour une autre raison (camion en révision) doit le rester |
| Créneau exceptionnel | Sans `template_id` | La régénération ne doit ni l'écraser ni le recréer |
| Contrainte affichée | Les deux jauges, avec **en gras celle qui limite** et une mention « complet en volume » / « en nombre de livraisons » | « 2/6 livraisons » sur un créneau à 17/18 m³ fait croire à tort qu'il reste de la place |
| « Plus réservable » | État distinct de « complet » : le volume restant est inférieur à la commande minimum | Cas réel constaté à l'écran — 23,5/24 m³ s'affichait « ouvert » alors qu'aucun client ne pouvait plus réserver |

**Bandeau de génération, en haut de l'écran.** La génération est idempotente mais ponctuelle : l'horizon recule d'un jour par jour écoulé. Le jour où plus rien n'est généré, le tunnel ne propose aucune date **sans lever la moindre erreur**. L'écran affiche donc jusqu'à quelle date les clients peuvent réserver, alerte quand l'horizon se rapproche, et offre un bouton « Générer les dates ». Le cron hebdomadaire `/api/cron/generate-slots` (lundi 4 h, `vercel.json`) fait le travail en temps normal.

### 6.3 `/admin/livraison/vehicules` et `/carburant`

Voir `docs/02` §2.2 et §2.4. Le simulateur de frais de livraison est présent sur les deux écrans.

---

## 6 bis. Devis `/admin/devis` — ✅ fait

**Liste** : onglets avec compteurs (à traiter, envoyés, acceptés, refusés, toutes), colonnes référence · date · client · commune · ce qu'il demande · origine · montant proposé · statut. Une demande sans réponse depuis deux jours porte la mention « depuis 3 j » en `--alerte` : dans ce métier, un prospect qui attend a déjà appelé ailleurs.

**Fiche** : la demande du client à gauche — telle qu'il l'a écrite, jamais modifiable —, la proposition chiffrée à droite. Sur téléphone, l'ordre devient demande → proposition → suivi, la proposition avant le suivi parce que c'est l'action principale.

| Bloc | Contenu |
|---|---|
| Sa demande | Coordonnées cliquables (`tel:`, `mailto:` avec objet pré-rempli), adresse, volume/essence/longueur/séchage souhaités, message, origine |
| Son panier | Ce que le visiteur avait dans son panier au moment de basculer en devis — l'intention d'achat la plus fiable disponible |
| Ce que je propose | Lignes (format + quantité), bouton « Reprendre le panier du client », livraison automatique ou fixée à la main, remise motivée, date de validité, totaux **calculés par le serveur** |
| Suivi | Statut libre (une demande se traite au téléphone, dans le désordre) et notes internes |

**Actions :** enregistrer · voir le PDF · envoyer par email avec le PDF joint · convertir en commande.

**Points de vigilance repris de l'implémentation :**

- Les alertes bloquantes sont affichées **en clair, au-dessus des boutons** : stock insuffisant (avec les chiffres et la conséquence), commune hors zone, volume supérieur à la flotte, frais au-dessus du plafond.
- Le total affiché, celui du PDF, celui de l'email et celui de la commande viennent tous de la même fonction `calculerProposition`. Il ne peut pas y avoir deux chiffres différents.
- La conversion est confirmée en deux temps, avec le montant et le nom du client dans la phrase de confirmation.
- Un devis déjà converti n'expose plus ni la conversion ni les autres statuts.

## 7. Clients `/admin/clients`

Liste avec recherche instantanée par nom, email, téléphone, commune. Colonnes : nom, commune, nombre de commandes, total dépensé, dernière commande.

**Fiche client :** coordonnées, adresses avec contraintes d'accès, historique complet des commandes, factures, notes internes, indicateurs (client depuis, fréquence, panier moyen), et un bouton **« Créer une commande pour ce client »** qui pré-remplit tout.

Actions : bloquer un client (motif obligatoire), fusionner deux fiches doublons, exporter en CSV, supprimer les données personnelles (droit à l'effacement RGPD — anonymise le client, conserve les commandes pour l'obligation comptable).

✅ **Implémenté le 9 août 2026.** La liste calcule les compteurs et le CA depuis les commandes
réelles, sans faire confiance aux colonnes récapitulatives de `customers`. La recherche instantanée
porte sur le nom, l'email, le téléphone, la société et la commune ; les filtres isolent clients
fidèles, professionnels et bloqués. L'export CSV neutralise les cellules commençant par un signe de
formule avant ouverture dans Excel.

La fiche rassemble coordonnées modifiables, adresses et contraintes d'accès, commandes, factures,
notes internes et indicateurs (ancienneté, panier moyen, volume, rythme médian et prochaine commande
probable). « Créer une commande » prépare un panier serveur vide avec le client et son adresse par
défaut, puis l'exploitant choisit les produits ; la commande finale porte `source = 'admin'` et
`created_by` quand la session gérant/secrétariat est toujours valide.

Le blocage exige un motif et empêche aussi le tunnel public de créer une commande. La fusion et
l'anonymisation sont réservées au gérant et exécutées par des fonctions Postgres atomiques. La
fusion déplace commandes, adresses et paniers ; l'anonymisation supprime coordonnées, adresses,
accès au compte et snapshots de livraison, tout en conservant montants et factures nécessaires à la
comptabilité. Le journal d'audit ne recopie aucune donnée personnelle après effacement.

---

## 8. Statistiques `/admin/statistiques`

✅ **Fait.** Filtre global (30 jours, 90 jours, saison de chauffe, 12 mois, dates personnalisées) avec comparaison à la période précédente sur les indicateurs de synthèse.

**Synthèse** — CA commandé TTC (commandes non annulées) · nombre de commandes · panier moyen · volume vendu · prix moyen réellement vendu au m³ après remise.

**Origine des ventes** — commandes et CA séparés entre `web`, `phone` et `admin`, avec taux d'automatisation du site en nombre et en valeur.

**Tunnel** — visiteurs (sessions anonymes) → panier → vérification de zone → créneau → paiement → commande. Chaque carte affiche le nombre arrivé, le nombre abandonné avant la suite et le taux de passage. La date de début réelle de collecte est toujours visible.

**Demande perdue** — hors zone, code postal inconnu, rupture, aucun créneau, paiement échoué ; nombre de blocages, m³ potentiels et CA potentiel, tous signalés comme estimations.

**Prix vendu** — globalement puis par essence, longueur, zone et mois. Livraison et options sont exclues ; la remise est ventilée au prorata des lignes.

**Stock** — vitesse hebdomadaire, disponible, réservé, jours d'autonomie, date de rupture estimée et ordre de production (`urgent`, `à produire`, `à surveiller`, `stable`).

**Devis** — reçus, envoyés, acceptés, refusés, conversion, montant gagné/perdu et délai moyen de réponse.

**Livraison** — frais facturés vs carburant + coût kilométrique, marge par zone, données manquantes signalées, délai commande → livraison global et par zone.

**Réactivation** — clients ayant au moins deux commandes et dont la prochaine commande estimée par leur rythme médian est proche.

**Secondaire** — annulations, remboursements, CA accompagné par les promotions, devis PDF → commandes → CA et SEO → commandes → CA. La carte de chaleur géographique et les exports comptables restent un enrichissement ultérieur.

Les chiffres sont agrégés côté serveur à partir des tables métier indexées. À l'échelle prévue (50 à 100 commandes par mois), cela garde des définitions lisibles et vérifiables. Une matérialisation ne sera ajoutée que lorsque le volume réel la justifiera ; elle ne doit jamais créer une seconde définition d'un indicateur.

---

## 9. Réglages `/admin/reglages`

| Onglet | Contenu | Rôle requis |
|---|---|---|
| Entreprise | Raison sociale, SIRET, TVA, coordonnées, dépôt (adresse + point GPS), horaires | owner |
| Thème | Couleurs (6 sélecteurs), logo clair, logo sombre, favicon, aperçu en direct | owner |
| Paiement | Activation par mode, plafond espèces, règles d'acompte, clés Stripe, RIB | **owner uniquement** |
| Facturation | Préfixe et numérotation, mentions légales de bas de facture, mode TVA, taux par défaut | **owner uniquement** |
| Commandes | Montant et volume minimums, délai de préparation, horizon de réservation | owner, staff |
| Notifications | Activation par événement, adresses de copie, heure du récap quotidien, expéditeur | owner, staff |
| Textes légaux | CGV (éditeur riche, versionnées), mentions légales, confidentialité, médiateur | owner |
| Fonctionnalités | Interrupteurs des feature flags : granulés, palettes, filets, promotions, SMS, blog, simulateur | owner |
| Utilisateurs | Inviter, changer de rôle, révoquer | owner |

L'onglet **Fonctionnalités** est le levier du modèle white-label : c'est là qu'on active la page granulés pour une entreprise et qu'on la masque pour une autre, sans toucher au code.

**Implémenté le 9 août 2026.** L'écran unique, réservé au gérant, regroupe six rubriques à ancres :
entreprise, nom/logo/couleurs, commandes et rangement, paiement/facturation,
notifications/textes légaux et fonctionnalités. Chaque action revérifie le rôle `owner`, valide la
saisie, journalise la modification dans `audit_log` puis rafraîchit immédiatement le site. Le
rangement est activable et tarifé par défaut à **20 € TTC / m³ apparent** ; le client voit cette
ligne au récapitulatif, et l'admin la retrouve sur la fiche commande.

L'upload ImageKit, les clés Stripe/RIB, l'éditeur riche des textes légaux et la gestion des
utilisateurs restent des enrichissements dédiés : l'écran actuel couvre les réglages effectivement
consommés par l'application sans exposer de secret au navigateur.

---

## 10. Notifications internes

Cloche dans l'en-tête admin avec badge. Événements : nouvelle commande, demande de devis, paiement reçu, échec de paiement, stock sous le seuil, anomalie de prix carburant. Clic → écran concerné. Marquage lu/non lu, conservation 30 jours.

C'est le complément indispensable du récap quotidien par email : le récap donne le rythme, la cloche capte l'imprévu.


---

## Médias et utilisateurs — 10 août 2026

### `/admin/medias`

Bibliothèque avec téléversement direct navigateur → ImageKit (le fichier ne transite pas par Vercel), glisser-déposer multiple, filtres par dossier, recherche sur le nom **et** la description, édition en ligne du texte alternatif.

Le texte alternatif est **exigé pour publier**, et son absence est signalée en rouge sur la vignette — volontairement inconfortable : une image sans description est inaccessible aux personnes malvoyantes et invisible pour Google. La galerie publique filtre ces images plutôt que de les afficher sans `alt`.

La suppression refuse si le média est utilisé par un produit : supprimer à l'aveugle laisserait une fiche sans photo, sans que personne s'en aperçoive avant qu'un client tombe dessus.

### Utilisateurs, dans `/admin/reglages`

Trois rôles, chacun **décrit en toutes lettres** à côté de son nom : « Secrétariat » ne dit pas si la personne verra les factures, la phrase si.

Invitation par email, sans lien d'acceptation : l'accès s'ouvre à la première connexion, sur l'email **vérifié par Supabase Auth** (fonction `consommer_invitations`, migration `20260810160000`). Un lien d'acceptation serait une clé d'accès à l'administration circulant dans une boîte mail ; se fier à une adresse saisie permettrait de réclamer l'invitation d'un tiers — même raisonnement que le rattachement des commandes invité.

⚠️ **Deux garde-fous, vérifiés en conditions réelles :**

1. l'entreprise conserve toujours au moins un gérant ;
2. personne ne peut se retirer soi-même — seul un autre gérant le peut, ce qui laisse une trace et un responsable.

Sans eux, un gérant peut se rétrograder et rendre réglages, facturation et gestion des utilisateurs définitivement inaccessibles : il faudrait repasser par la base.

### Piège payé deux fois

Un module `"use server"` ne peut exporter que des **fonctions asynchrones**, et un composant client ne peut pas importer une valeur d'un module `server-only`. Dans les deux cas le typecheck passe et l'écran plante au premier affichage. Le vocabulaire partagé vit donc dans `lib/` : `lib/medias.ts` (dossiers), `lib/roles.ts` (rôles), `lib/slug.ts` (slugs — qui était en prime intestable tant qu'il restait derrière `server-only`).
