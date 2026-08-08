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

### 6.2 `/admin/livraison/creneaux`

Gestion des modèles récurrents (jour, horaires, capacité en nombre **et** en volume, véhicule, zones concernées) et calendrier des 8 prochaines semaines avec le taux de remplissage de chaque créneau (`4/8 livraisons · 12/20 m³`).

Clic sur un jour → fermer, modifier la capacité ponctuellement, ajouter un créneau exceptionnel. Bouton « Bloquer une période » pour les congés.

### 6.3 `/admin/livraison/vehicules` et `/carburant`

Voir `docs/02` §2.2 et §2.4. Le simulateur de frais de livraison est présent sur les deux écrans.

---

## 7. Clients `/admin/clients`

Liste avec recherche instantanée par nom, email, téléphone, commune. Colonnes : nom, commune, nombre de commandes, total dépensé, dernière commande.

**Fiche client :** coordonnées, adresses avec contraintes d'accès, historique complet des commandes, factures, notes internes, indicateurs (client depuis, fréquence, panier moyen), et un bouton **« Créer une commande pour ce client »** qui pré-remplit tout.

Actions : bloquer un client (motif obligatoire), fusionner deux fiches doublons, exporter en CSV, supprimer les données personnelles (droit à l'effacement RGPD — anonymise le client, conserve les commandes pour l'obligation comptable).

---

## 8. Statistiques `/admin/statistiques`

Demandé « poussées ». Filtre de période global (mois, trimestre, saison de chauffe, année, personnalisé) avec comparaison à la période précédente sur chaque indicateur.

**Ventes** — CA TTC et HT · nombre de commandes · panier moyen · volume vendu en m³ · courbe journalière · répartition par mois.

**Produits** — classement par CA et par volume · répartition par longueur de coupe · par essence · par classe d'humidité · formats jamais vendus (candidats à la suppression).

**Livraison** — répartition par zone · CA par commune (**avec carte de chaleur** — c'est ce qui indique où tracter) · distance moyenne · frais de livraison encaissés vs coût carburant estimé · taux de remplissage des créneaux par jour de semaine.

**Clients** — nouveaux vs récurrents · **taux de retour annuel** (indicateur décisif dans ce métier) · délai moyen entre deux commandes · classement des meilleurs clients · répartition particuliers/professionnels.

**Paiement** — répartition par mode · montant encaissé en espèces sur la période · impayés en cours · délai moyen d'encaissement des virements.

**Exports** — CSV pour chaque tableau, export comptable mensuel (commandes, factures, TVA ventilée) au format attendu par un expert-comptable.

Toutes les métriques sont calculées par des **vues SQL matérialisées** rafraîchies quotidiennement, pas par des agrégations à la volée. Les graphiques utilisent la palette du design system et respectent la règle « jamais la couleur seule » (libellés + valeurs affichées).

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

---

## 10. Notifications internes

Cloche dans l'en-tête admin avec badge. Événements : nouvelle commande, demande de devis, paiement reçu, échec de paiement, stock sous le seuil, anomalie de prix carburant. Clic → écran concerné. Marquage lu/non lu, conservation 30 jours.

C'est le complément indispensable du récap quotidien par email : le récap donne le rythme, la cloche capte l'imprévu.
