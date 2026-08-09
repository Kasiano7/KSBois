# 01 — Architecture technique & modèle de données

> Référence : `PLAN.md` §2.6 et §5.

---

## 1. Stack

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Next.js 16.3, App Router, TypeScript strict** | RSC = prix calculés serveur par défaut, SEO natif, Server Actions pour les mutations |
| Styles | **Tailwind CSS v4** + tokens CSS custom properties | Le thème white-label passe par des variables CSS injectées au runtime, pas par une reconfiguration Tailwind |
| Composants | **shadcn/ui** (copiés dans le repo, pas en dépendance) | Contrôle total, restylables via tokens, accessibles (Radix) |
| Base de données | **Supabase Postgres 15+** | RLS = isolation multi-tenant au niveau SQL, la meilleure garantie de sécurité |
| Auth | **Supabase Auth** — OTP email (lien magique) + mot de passe optionnel | Le lien magique supprime la friction pour une audience 55+ |
| Fichiers privés | **Supabase Storage** (factures, bons de livraison, exports) | Signés, à durée limitée. **Jamais sur ImageKit** |
| Médias publics | **ImageKit** | Voir `docs/04` |
| Paiement | **Stripe** — Payment Intents + webhooks signés | |
| Terminal physique | **SumUp** — hors ligne, saisi manuellement dans l'admin | Le boîtier est dans le camion, aucune intégration API en V1 |
| Email | **Resend** + **React Email** | Templates typés, versionnés dans le repo |
| PDF | **@react-pdf/renderer** exécuté côté serveur | Devis, factures, bons de livraison, feuille de tournée |
| Cron | **Vercel Cron** → Route Handler protégé par secret | Prix carburant, génération de créneaux, récap quotidien, purge des statistiques |
| Validation | **Zod** — un schéma par frontière (form, action, API, webhook) | |
| Tests | **Vitest** (unitaire, moteurs métier) + **Playwright** (E2E tunnel) | |
| Observabilité | **Sentry** + Vercel Analytics | |
| Hébergement | **Vercel** (région `cdg1` — Paris) | Latence minimale vers Supabase EU |

### 1.0 ⚠️ Next.js 16 — écarts par rapport à Next.js 15

Le projet tourne sur **Next.js 16.3**, qui introduit des ruptures. Ces points ont été vérifiés sur l'installation réelle, pas supposés. `AGENTS.md` à la racine impose de consulter `node_modules/next/dist/docs/` avant d'écrire du code : **cette règle s'applique à Codex aussi.**

| Sujet | Next 15 | **Next 16 — à appliquer** |
|---|---|---|
| Middleware | `middleware.ts`, export `middleware` | **`proxy.ts`, export `proxy`**. Runtime Node.js uniquement, non configurable. C'est là que se fait la résolution du tenant par nom de domaine |
| Invalidation de cache | `revalidateTag('produits')` | **`revalidateTag('produits', 'max')`** — le second argument (profil `cacheLife`) est obligatoire |
| Lecture après écriture | — | **`updateTag('tag')`** dans une Server Action : expire et rafraîchit dans la même requête. À utiliser après toute mutation admin, sinon l'exploitant ne voit pas sa modification |
| Rafraîchir le routeur | — | `refresh()` depuis `next/cache` |
| `cacheLife` / `cacheTag` | `unstable_` | Stables, sans préfixe |
| API de requête | Sync toléré | **Toujours `await`** : `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` |
| Types de page | Manuels | Helpers globaux **`PageProps<'/route'>`**, `LayoutProps<'/'>`, `RouteContext<'/api/x'>`, générés par `next typegen` |
| Lint | `next lint` | **Supprimé** — ESLint en CLI directe (`npm run lint`). `next build` ne lint plus |
| Bundler | Webpack | **Turbopack par défaut** en dev et en build |
| PPR | `experimental.ppr` | Supprimé — remplacé par `cacheComponents`. **Non adopté sur ce projet** |
| Routes parallèles | Optionnel | `default.tsx` **obligatoire** dans chaque slot, sinon le build échoue |
| `next/font` | — | **`axes` est incompatible avec une liste `weight`.** Piège rencontré sur Fraunces : pour une police variable, on omet `weight` (voir `src/app/layout.tsx`) |
| `next/image` | — | Défauts changés : `qualities: [75]`, `minimumCacheTTL: 4 h`, `images.domains` déprécié au profit de `remotePatterns`. Impact faible, les médias passent par ImageKit |
| Runtime config | `serverRuntimeConfig` | Supprimé — variables d'environnement uniquement |

### 1.1 Règles d'usage Next.js

- **Server Components par défaut.** `'use client'` uniquement pour : panier, sélecteurs interactifs, formulaires complexes, carte, drag & drop admin.
- **Server Actions** pour toutes les mutations. Chaque action commence par `await requireAuth(role)` et valide son entrée avec Zod. Aucune action n'est exportée sans contrôle d'accès.
- **Route Handlers** réservés aux : webhooks (Stripe), auth ImageKit, crons, sitemaps, PDF en téléchargement direct.
- **`revalidateTag`** pour l'invalidation ciblée (`products`, `zones`, `settings`, `slots`).
- Le catalogue public est **statiquement généré + ISR** ; le panier et le tunnel sont **dynamiques**.
- La clé `service_role` de Supabase n'existe que dans les Server Actions, Route Handlers et crons. **Jamais** dans un composant client, jamais dans une variable `NEXT_PUBLIC_`.

---

## 2. Arborescence du repo

```
bois-chauffage/
├── PLAN.md
├── docs/                          # ce plan
├── app/
│   ├── (site)/                    # front public — layout clair/sombre mixte
│   │   ├── page.tsx                       # accueil
│   │   ├── bois-de-chauffage/
│   │   │   ├── page.tsx                   # catalogue
│   │   │   └── [slug]/page.tsx            # fiche produit
│   │   ├── granules/page.tsx              # conditionné par feature flag
│   │   ├── livraison/
│   │   │   ├── page.tsx                   # zones + tarifs
│   │   │   └── [commune]/page.tsx         # page SEO locale
│   │   ├── panier/page.tsx
│   │   ├── commande/                      # tunnel, 4 étapes
│   │   │   ├── livraison/page.tsx
│   │   │   ├── creneau/page.tsx
│   │   │   ├── paiement/page.tsx
│   │   │   └── confirmation/[ref]/page.tsx
│   │   ├── devis/page.tsx
│   │   ├── notre-entreprise/page.tsx
│   │   ├── savoir-faire/page.tsx
│   │   ├── galerie/page.tsx
│   │   ├── guides/[slug]/page.tsx
│   │   ├── compte/                        # espace client
│   │   │   ├── page.tsx
│   │   │   ├── commandes/[ref]/page.tsx
│   │   │   ├── adresses/page.tsx
│   │   │   └── factures/page.tsx
│   │   └── (legal)/{mentions-legales,cgv,confidentialite,retractation}/page.tsx
│   ├── admin/                     # back-office — layout sombre dense
│   │   ├── page.tsx                       # dashboard
│   │   ├── commandes/[id]/page.tsx
│   │   ├── tournee/page.tsx               # organisation des livraisons
│   │   ├── produits/[id]/page.tsx
│   │   ├── stock/page.tsx
│   │   ├── clients/[id]/page.tsx
│   │   ├── devis/[id]/page.tsx
│   │   ├── livraison/{zones,creneaux,vehicules,carburant}/page.tsx
│   │   ├── medias/page.tsx
│   │   ├── promotions/page.tsx
│   │   ├── statistiques/page.tsx
│   │   └── reglages/{entreprise,paiement,facturation,notifications,theme}/page.tsx
│   ├── livreur/page.tsx           # vue mobile tournée du jour
│   └── api/
│       ├── webhooks/stripe/route.ts
│       ├── imagekit/auth/route.ts
│       ├── cron/{fuel-price,generate-slots,daily-digest,stock-alerts}/route.ts
│       └── pdf/{devis,facture,bon-livraison,tournee}/route.ts
├── src/
│   ├── domain/                    # ⚠️ CŒUR MÉTIER — pur TypeScript, zéro I/O, 100 % testé
│   │   ├── pricing/               # paliers, remises, TVA, totaux
│   │   ├── delivery/              # zones, distance, carburant, véhicule
│   │   ├── slots/                 # disponibilité, capacité
│   │   ├── stock/                 # réservation, disponibilité
│   │   ├── orders/                # machine à états
│   │   └── units/                 # m³app, stère, coefficients
│   ├── server/                    # accès données, Server Actions, services
│   ├── components/                # UI
│   ├── emails/                    # templates React Email
│   ├── pdf/                       # documents @react-pdf
│   └── lib/                       # supabase, imagekit, stripe, resend, zod, utils
├── supabase/migrations/           # migrations SQL numérotées
├── supabase/seed/                 # jeux de données démo
└── tests/{unit,e2e}/
```

**Règle structurante :** `src/domain/` ne connaît ni Supabase, ni Next, ni Stripe. Il prend des objets, rend des objets. C'est ce qui rend les règles de prix et de livraison testables en millisecondes et réutilisables pour un futur SaaS.

---

## 3. Modèle de données

Conventions : `snake_case`, PK `uuid default gen_random_uuid()`, montants en **centimes `integer`**, volumes en `numeric(10,3)`, timestamps `timestamptz`, `company_id` obligatoire sur toute table métier, `created_at`/`updated_at` partout.

### 3.1 Socle multi-tenant

```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  legal_name text, siret text, rcs text, vat_number text, ape_code text,
  email text not null, phone text, phone_display text,
  address_line1 text, postal_code text, city text,
  depot_lat numeric(9,6), depot_lng numeric(9,6),   -- point de départ des tournées
  vat_mode text not null default 'assujetti',        -- 'assujetti' | 'franchise_en_base'
  pricing_basis text not null default 'map_delivered',
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Paris',
  is_active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- résolution du tenant par nom de domaine (middleware)
create table company_domains (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  hostname text unique not null,
  is_primary boolean not null default false
);

-- thème white-label : couleurs, polices, logo. Injecté en CSS custom properties.
create table company_themes (
  company_id uuid primary key references companies(id) on delete cascade,
  tokens jsonb not null default '{}',       -- {"color-primary":"#22392C", ...}
  logo_media_id uuid, logo_dark_media_id uuid, favicon_media_id uuid,
  font_display text default 'Fraunces', font_body text default 'Archivo'
);

-- flags d'activation par entreprise
create table company_features (
  company_id uuid primary key references companies(id) on delete cascade,
  pellets boolean default false,
  kindling boolean default true,
  pallets boolean default false,
  nets boolean default false,
  pickup boolean default true,
  services boolean default false,        -- prestations (rangement...)
  promotions boolean default true,
  sms boolean default false,
  quotes boolean default true,
  fuel_surcharge boolean default true,
  route_optimization boolean default false,
  blog boolean default true,
  needs_calculator boolean default true
);

-- réglages divers typés faiblement, pour éviter une migration par réglage
create table company_settings (
  company_id uuid references companies(id) on delete cascade,
  key text not null,
  value jsonb not null,
  primary key (company_id, key)
);
```

**Clés `company_settings` prévues :** `order.min_amount_cents`, `order.min_volume_m3`, `order.lead_time_days`, `order.booking_horizon_days`, `payment.cash_limit_cents`, `payment.deposit_percent`, `payment.deposit_trigger_volume_m3`, `payment.deposit_trigger_km`, `delivery.rounding_step_cents`, `delivery.free_threshold_cents`, `stock.low_threshold_default`, `notifications.digest_hour`, `legal.cgv_version`, `seo.default_meta`.

### 3.2 Utilisateurs

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, full_name text, phone text,
  created_at timestamptz default now()
);

create table company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner','staff','driver')),
  unique (company_id, user_id)
);

-- un client peut exister SANS compte (commande invité)
create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- ⚠️ Référence PROFILES, pas auth.users : un compte créé par lien magique
  -- n'a pas encore de profil, il faut l'insérer d'abord (migration 20260809130000).
  user_id uuid references profiles(id) on delete set null,   -- null = invité
  email text not null, phone text,
  first_name text, last_name text,
  is_company boolean default false,
  company_name text, siret text, vat_number text,
  customer_type text default 'particulier',   -- 'particulier' | 'professionnel'
  price_group_id uuid,                        -- tarifs négociés (V2)
  internal_notes text,                        -- visible admin uniquement
  is_blocked boolean default false,
  accepts_marketing boolean default false,
  total_orders integer default 0, total_spent_cents bigint default 0,
  created_at timestamptz default now()
);
create unique index on customers (company_id, lower(email));

create table addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  label text,                          -- "Maison", "Chalet"
  first_name text, last_name text, phone text,
  line1 text not null, line2 text,
  postal_code text not null, city text not null,
  insee_code text,                     -- code commune officiel — clé de zonage
  lat numeric(9,6), lng numeric(9,6),
  -- contraintes d'accès : LE champ qui évite les livraisons ratées
  access_notes text,
  truck_access text,                   -- 'spl' | 'camion' | 'fourgon' | 'remorque_seule'
  unload_type text,                    -- 'vrac_sol' | 'range' | 'benne'
  has_slope boolean default false, has_gate boolean default false,
  allow_unattended_delivery boolean default false,
  is_default boolean default false,
  created_at timestamptz default now()
);
```

### 3.3 Catalogue

```sql
create table wood_species (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null, name text not null,
  hardness_group text,                 -- 'G1' | 'G2' | 'G3'
  calorific_kwh_per_m3 integer,
  description text, warning text,      -- ex. châtaignier : projections
  sort_order integer default 0, is_active boolean default true,
  unique (company_id, code)
);

create table cut_lengths (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  cm integer not null,                 -- 25, 33, 40, 50, 100
  label text not null,                 -- "33 cm"
  stacking_coefficient numeric(4,3) not null,   -- cf. PLAN.md §3.2
  sort_order integer default 0, is_active boolean default true,
  unique (company_id, cm)
);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  slug text not null, name text not null, description text,
  hero_media_id uuid, sort_order integer default 0, is_active boolean default true,
  seo_title text, seo_description text,
  unique (company_id, slug)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category_id uuid references product_categories(id) on delete set null,
  slug text not null, name text not null,
  short_description text, description text,       -- markdown
  species_ids uuid[] default '{}',                -- essences composant le produit
  product_type text not null default 'buches',    -- 'buches'|'granules'|'allumage'|'service'
  badges text[] default '{}',                     -- 'local','sec','coup_de_coeur'
  is_active boolean default true, is_featured boolean default false,
  seo_title text, seo_description text,
  sort_order integer default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (company_id, slug)
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sku text not null,
  cut_length_id uuid references cut_lengths(id),
  humidity_class text,                    -- 'H1'|'H2'|'H3'
  measured_humidity_pct numeric(4,1),     -- si mesuré → jauge affichée
  packaging text not null default 'vrac', -- 'vrac'|'palette'|'filet'|'sac'
  -- unité de vente
  unit text not null default 'm3app',     -- 'm3app'|'palette'|'filet'|'sac'|'tonne'
  unit_volume_m3 numeric(10,3) not null default 1.000, -- volume d'1 unité vendue
  unit_weight_kg numeric(10,2),
  -- prix
  base_price_cents integer not null,      -- prix TTC d'1 unité
  compare_at_price_cents integer,         -- prix barré
  vat_rate numeric(5,2) not null default 10.00,
  -- quantités
  min_quantity numeric(10,3) default 1, max_quantity numeric(10,3),
  quantity_step numeric(10,3) default 1,  -- 0.5 si demi-stère autorisé
  -- stock
  stock_on_hand numeric(12,3) not null default 0,
  stock_reserved numeric(12,3) not null default 0,
  low_stock_threshold numeric(12,3) default 5,
  allow_backorder boolean default false,
  backorder_available_at date,
  track_stock boolean default true,
  is_active boolean default true, sort_order integer default 0,
  unique (company_id, sku)
);
-- stock vendable = stock_on_hand - stock_reserved (colonne générée en lecture)
alter table product_variants
  add column stock_available numeric(12,3)
  generated always as (stock_on_hand - stock_reserved) stored;

-- prix dégressifs par quantité
create table price_tiers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  min_quantity numeric(10,3) not null,
  unit_price_cents integer not null,
  sort_order integer default 0
);

-- options payantes (rangement, allume-feu offert, petite quantité…)
create table product_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null, name text not null, description text,
  price_cents integer not null default 0,
  price_type text default 'fixed',        -- 'fixed' | 'per_m3'
  vat_rate numeric(5,2) default 20.00,
  applies_to text default 'order',        -- 'order' | 'variant'
  is_active boolean default true,
  unique (company_id, code)
);
```

### 3.4 Médias

```sql
create table media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  imagekit_file_id text not null,
  file_path text not null,          -- chemin ImageKit, PAS l'URL complète
  file_name text not null,
  media_type text not null,         -- 'image' | 'video'
  mime text, size_bytes bigint,
  width integer, height integer, duration_seconds numeric(8,2),
  lqip text,                        -- data-URI base64 basse def, anti-CLS
  alt_text text,                    -- obligatoire pour publication
  caption text, credit text,
  tags text[] default '{}',
  folder text,                      -- 'products'|'gallery'|'brand'|'guides'
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (company_id, imagekit_file_id)
);

create table product_media (
  product_id uuid references products(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  sort_order integer default 0, is_primary boolean default false,
  primary key (product_id, media_id)
);
```

### 3.5 Livraison

```sql
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,                        -- "Camion benne 19T"
  vehicle_type text not null,                -- 'fourgon'|'camion'|'spl'|'remorque'
  capacity_m3 numeric(10,3) not null,
  capacity_pallets integer,
  fuel_consumption_l_per_100km numeric(6,2) not null default 25,
  max_distance_km integer,
  cost_per_km_cents integer default 0,        -- coût fixe hors carburant (usure)
  is_active boolean default true, sort_order integer default 0
);

create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,                        -- "Zone A — 0-15 km"
  color text,                                -- affichage carte admin
  base_fee_cents integer not null default 0,
  fee_per_m3_cents integer not null default 0,
  free_above_cents integer,                  -- livraison offerte au-delà de X €
  min_order_amount_cents integer default 0,
  min_order_volume_m3 numeric(10,3) default 0,
  distance_km_estimate integer,              -- pour la surcharge carburant
  delivery_days integer[] default '{1,2,3,4,5}',  -- ISO 1=lundi
  lead_time_days integer,                    -- null = valeur globale
  is_active boolean not null default true,
  sort_order integer default 0
);

-- rattachement commune → zone. C'est la table que l'admin manipule le plus.
create table zone_communes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  zone_id uuid references delivery_zones(id) on delete cascade,  -- null = non desservi
  postal_code text not null,
  city text not null,
  insee_code text,
  distance_km numeric(6,1),                  -- distance routière réelle depuis le dépôt
  delivery_days integer[],                   -- surcharge les jours de la zone
  is_served boolean not null default true,
  notes text,
  unique (company_id, postal_code, city)
);
create index on zone_communes (company_id, postal_code);

-- historique du prix du gazole (cron quotidien)
create table fuel_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fuel_type text not null default 'gazole',
  price_per_liter_cents integer not null,
  source text not null,                      -- 'data.economie.gouv.fr' | 'manual'
  sample_size integer, department text,
  recorded_at timestamptz not null default now()
);
create index on fuel_prices (company_id, recorded_at desc);
```

### 3.6 Créneaux

```sql
-- règles récurrentes définies par l'admin
create table slot_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  start_time time not null, end_time time not null,
  label text not null,                       -- "Matin 8h-12h"
  max_deliveries integer not null default 8,
  max_volume_m3 numeric(10,3) not null default 20,   -- ⚠️ la vraie contrainte
  vehicle_id uuid references vehicles(id),
  zone_ids uuid[] default '{}',              -- vide = toutes zones
  is_active boolean default true
);

-- instances générées à l'avance (cron) et ajustables individuellement
create table delivery_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  template_id uuid references slot_templates(id) on delete set null,
  date date not null,
  start_time time not null, end_time time not null,
  label text not null,
  max_deliveries integer not null,
  max_volume_m3 numeric(10,3) not null,
  booked_deliveries integer not null default 0,
  booked_volume_m3 numeric(10,3) not null default 0,
  vehicle_id uuid references vehicles(id),
  zone_ids uuid[] default '{}',
  is_open boolean not null default true,
  closed_reason text,
  -- Fermeture due à une période bloquée. Permet de rouvrir EXACTEMENT les
  -- créneaux fermés par cette période, et pas ceux fermés pour une autre
  -- raison (migration 20260809100000, voir docs/05 §6.2).
  closed_by_blackout_id uuid references slot_blackouts(id) on delete set null,
  unique (company_id, date, start_time, end_time)
);
create index on delivery_slots (company_id, date);

-- fermetures : congés, jours fériés, intempéries
create table slot_blackouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  start_date date not null, end_date date not null,
  reason text, applies_to_zone_ids uuid[] default '{}'
);
```

### 3.7 Commandes

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  reference text not null,                   -- "CMD-2026-0142"
  customer_id uuid references customers(id) on delete set null,
  is_guest boolean not null default false,
  status text not null default 'nouvelle',
  -- contact figé au moment de la commande
  email text not null, phone text,
  first_name text, last_name text,
  -- livraison
  fulfillment_type text not null default 'delivery',   -- 'delivery' | 'pickup'
  shipping_address jsonb,                    -- snapshot complet, jamais une FK seule
  zone_id uuid references delivery_zones(id),
  distance_km numeric(6,1),
  vehicle_id uuid references vehicles(id),
  slot_id uuid references delivery_slots(id),
  requested_slot_label text,                 -- souhait client
  confirmed_delivery_date date,              -- confirmé par l'entreprise
  confirmed_slot_label text,
  delivery_notes text,                       -- saisi par le client
  internal_notes text,                       -- saisi par l'admin
  -- montants, tous TTC en centimes
  subtotal_cents integer not null default 0,
  options_cents integer not null default 0,
  discount_cents integer not null default 0,
  delivery_base_cents integer not null default 0,
  delivery_volume_cents integer not null default 0,
  delivery_fuel_cents integer not null default 0,
  delivery_total_cents integer not null default 0,
  total_cents integer not null default 0,
  vat_breakdown jsonb default '[]',          -- [{rate:10, base:.., vat:..}]
  total_volume_m3 numeric(10,3) not null default 0,
  -- paiement
  payment_method text,                       -- 'card'|'cash'|'check'|'transfer'|'sumup'
  payment_status text not null default 'pending',  -- 'pending'|'deposit_paid'|'paid'|'refunded'|'failed'
  deposit_required_cents integer default 0,
  amount_paid_cents integer default 0,
  -- promo & conformité
  promotion_id uuid, promotion_code text,
  cgv_version text, cgv_accepted_at timestamptz,
  fuel_price_snapshot_cents integer,         -- traçabilité du calcul
  pricing_snapshot jsonb,                    -- toutes les règles au moment T
  source text default 'web',                 -- 'web'|'admin'|'phone'
  created_by uuid references profiles(id),   -- si commande manuelle
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (company_id, reference)
);
create index on orders (company_id, status, created_at desc);
create index on orders (company_id, confirmed_delivery_date);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  -- snapshot : le produit peut être modifié ou supprimé plus tard
  product_name text not null, variant_label text not null, sku text not null,
  species_label text, cut_length_cm integer, humidity_class text, packaging text,
  quantity numeric(10,3) not null,
  unit text not null,
  unit_volume_m3 numeric(10,3) not null,
  line_volume_m3 numeric(10,3) not null,
  unit_price_cents integer not null,         -- prix effectivement appliqué (palier inclus)
  line_total_cents integer not null,
  vat_rate numeric(5,2) not null,
  is_backorder boolean default false
);

create table order_option_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  option_id uuid references product_options(id),
  name text not null, price_cents integer not null, vat_rate numeric(5,2)
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null, order_id uuid not null references orders(id) on delete cascade,
  from_status text, to_status text not null,
  changed_by uuid references profiles(id),
  actor text default 'admin',                -- 'admin'|'system'|'driver'|'customer'
  note text, created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null, order_id uuid not null references orders(id) on delete cascade,
  method text not null, kind text not null default 'full',   -- 'deposit'|'full'|'balance'
  amount_cents integer not null,
  status text not null,                      -- 'pending'|'succeeded'|'failed'|'refunded'
  stripe_payment_intent_id text, stripe_charge_id text,
  received_at timestamptz, recorded_by uuid references profiles(id),
  reference text,                            -- n° de chèque, réf. virement, ticket SumUp
  notes text, created_at timestamptz default now()
);
create unique index on payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null, order_id uuid not null references orders(id),
  number text not null,                      -- séquence légale ininterrompue
  issued_at date not null,
  -- données structurées, PAS seulement un PDF → prépare Factur-X
  seller jsonb not null, buyer jsonb not null, lines jsonb not null,
  totals jsonb not null, vat_breakdown jsonb not null,
  storage_path text,                         -- Supabase Storage, privé
  is_credit_note boolean default false, parent_invoice_id uuid,
  unique (company_id, number)
);

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  reference text not null, status text default 'nouveau',  -- 'nouveau'|'en_cours'|'envoye'|'accepte'|'refuse'
  first_name text, last_name text, company_name text,
  email text not null, phone text,
  address_line1 text, postal_code text, city text,
  species text, cut_length_cm integer, quantity_m3 numeric(10,3),
  humidity_preference text, message text,
  origin text default 'form',                -- 'form' | 'out_of_zone' | 'large_order'
  cart_snapshot jsonb,                       -- si issu d'un panier hors zone
  estimated_total_cents integer, admin_notes text,
  responded_at timestamptz, created_at timestamptz default now(),
  -- Proposition commerciale (migration 20260809110000, voir docs/02 §7.2).
  -- ⚠️ proposal_lines ne contient QUE des variantId + quantités : les prix sont
  -- recalculés à chaque lecture, comme pour le panier.
  proposal_lines jsonb not null default '[]',
  delivery_included boolean not null default true,
  delivery_cents integer,          -- null = calcul automatique (commune desservie)
  discount_cents integer not null default 0, discount_label text,
  valid_until date,
  converted_order_id uuid references orders(id) on delete set null
);

create table promotions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null, name text,
  discount_type text not null,               -- 'percent'|'fixed'|'free_delivery'
  discount_value integer not null,
  min_order_cents integer default 0, min_volume_m3 numeric(10,3) default 0,
  starts_at timestamptz, ends_at timestamptz,
  max_uses integer, max_uses_per_customer integer default 1, used_count integer default 0,
  applies_to_variant_ids uuid[] default '{}',
  is_active boolean default true,
  unique (company_id, code)
);
```

### 3.8 Stock, notifications, audit

```sql
-- toute variation de stock est tracée : jamais d'UPDATE nu sur stock_on_hand
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  movement_type text not null,   -- 'production'|'reservation'|'release'|'shipment'|'adjustment'|'loss'
  quantity numeric(12,3) not null,          -- signé
  stock_after numeric(12,3) not null,
  order_id uuid references orders(id) on delete set null,
  reason text, created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index on stock_movements (company_id, variant_id, created_at desc);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  channel text not null,                     -- 'email'|'sms'
  template text not null, recipient text not null,
  order_id uuid references orders(id) on delete set null,
  status text not null,                      -- 'queued'|'sent'|'failed'
  provider_id text, error text,
  sent_at timestamptz, created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  actor_id uuid references profiles(id), actor_role text,
  action text not null,                      -- 'order.status_changed', 'variant.price_changed'
  entity_type text not null, entity_id uuid,
  before jsonb, after jsonb, ip inet,
  created_at timestamptz default now()
);
```

**Tables à créer aussi (détaillées dans les docs suivants) :** `guides` (blog), `commune_pages` (SEO local), `reviews_cache` (avis Google), `carts` (panier serveur persistant).

### 3.9 Mesure du parcours et attribution des ventes

La migration `20260809120000_statistiques.sql` ajoute deux tables strictement dédiées à la mesure :

| Table | Rôle | Données volontairement absentes |
|---|---|---|
| `analytics_sessions` | Une session anonyme de 30 minutes, sa source d'acquisition, sa page d'entrée et sa campagne éventuelle | IP, email, téléphone, adresse, identifiant publicitaire |
| `analytics_events` | Première atteinte de chaque étape (`visit`, `cart`, `zone_check`, `slot`, `payment`, `order`, `quote_pdf`) et blocages (`lost_demand`) | Texte libre client, données de formulaire, URL complète du référent |

Une session ne compte chaque étape du tunnel qu'une fois. Les blocages conservent, lorsqu'ils sont calculables côté serveur, le volume et le CA **potentiels** du panier ; ces montants sont toujours présentés comme des estimations, jamais comme du CA.

Trois colonnes figent l'attribution sur `orders` : `analytics_session_id`, `acquisition_source` et `quote_pdf_before_order`. Ainsi, les statistiques SEO et « devis PDF → commande » survivent à la purge des événements. Les nouvelles tables ont RLS activée et forcée, ne sont jamais accessibles à `anon`, et ne sont écrites que par la route serveur validée.

---

## 4. Sécurité au niveau base — RLS

**Règle absolue : RLS activée sur 100 % des tables.** Aucune exception, y compris les tables de configuration.

### 4.0 ⚠️ RLS et GRANT sont deux mécanismes distincts — il faut les deux

Piège rencontré et corrigé pendant l'implémentation, à ne jamais reproduire :

- **GRANT sans RLS** → tout le monde voit tout.
- **RLS sans GRANT** → personne ne voit rien, l'application renvoie `permission denied`.
- **Oublier `service_role`** → tout le code serveur casse, y compris la résolution du tenant. `service_role` contourne la RLS (attribut `BYPASSRLS`) mais **a toujours besoin des privilèges de table**.

Les privilèges sont posés dans `supabase/migrations/…_grants.sql`, et exploités comme une **seconde barrière volontaire** :

| Rôle | Privilèges |
|---|---|
| `anon` | `SELECT` sur le seul catalogue public · `INSERT` sur `quote_requests` et `stock_alerts` · **rien d'autre** |
| `authenticated` | Privilèges larges, filtrés par les policies |
| `service_role` | Tout — usage serveur exclusif |

Conséquence recherchée : même si une policy était mal écrite sur `customers`, `orders`, `payments`, `promotions` ou `company_settings`, un visiteur anonyme serait **refusé au niveau du privilège**, avant d'atteindre la policy. Le test `supabase/tests/rls_isolation.sql` vérifie explicitement les deux barrières.

Les tables strictement serveur (`carts`, `order_access_tokens`, `document_sequences`, `processed_webhook_events`) et les fonctions transactionnelles n'ont **aucun** privilège pour `anon` ni `authenticated`.

**Commande de vérification :** `npm run db:test` — échoue bruyamment à la moindre fuite.

### 4.1 Fonctions d'aide

```sql
create or replace function auth_company_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(company_id), '{}') from company_members where user_id = auth.uid();
$$;

create or replace function has_company_role(cid uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from company_members
    where user_id = auth.uid() and company_id = cid and role = any(roles)
  );
$$;
```

### 4.2 Matrice de politiques

| Table | `anon` (public) | `customer` | `staff` / `driver` | `owner` |
|---|---|---|---|---|
| `companies`, `company_themes`, `company_features` | SELECT si `is_active` | idem | SELECT | ALL |
| `company_settings` | ❌ **aucun accès** — lu côté serveur uniquement | ❌ | SELECT (clés non sensibles) | ALL |
| `products`, `product_variants`, `price_tiers`, `media` | SELECT si `is_active` | idem | ALL | ALL |
| `delivery_zones`, `zone_communes`, `vehicles` | SELECT si `is_active` | idem | SELECT | ALL |
| `delivery_slots` | SELECT si `is_open` et date future | idem | ALL | ALL |
| `customers`, `addresses` | ❌ | SELECT/UPDATE si `user_id = auth.uid()` | SELECT/UPDATE | ALL |
| `orders`, `order_items` | ❌ | SELECT si propriétaire | SELECT/UPDATE | ALL |
| `payments`, `invoices` | ❌ | SELECT si propriétaire | SELECT ; INSERT limité | ALL |
| `stock_movements` | ❌ | ❌ | SELECT/INSERT | ALL |
| `quote_requests` | INSERT seul (rate-limité) | ❌ | ALL | ALL |
| `promotions` | ❌ — validation serveur uniquement | ❌ | SELECT | ALL |
| `audit_log`, `notifications_log`, `fuel_prices` | ❌ | ❌ | SELECT | SELECT |
| `analytics_sessions`, `analytics_events` | ❌ | ❌ | SELECT | SELECT |

**Points de vigilance :**

- Les **commandes invité** ne sont accessibles que via un **token opaque signé** (`order_access_tokens`, expiration 90 jours) transmis dans l'e-mail de confirmation. Jamais par la référence seule — une référence est devinable.
- `promotions` n'est **jamais** lisible côté client : le code est envoyé au serveur qui répond « valide / invalide + montant ». Sinon on expose tous les codes actifs.
- `company_settings` contient des seuils exploitables (plafond espèces, déclencheur d'acompte) : lecture serveur exclusivement.
- Les écritures de stock et de statut passent par des **fonctions `security definer`**, pas par des policies UPDATE ouvertes.

### 4.3 Résolution du tenant

**⚠️ Dette technique assumée à ce stade.** L'implémentation actuelle (`src/lib/tenant.ts`) lit `headers()` pour obtenir le nom de domaine. Toute page qui en dépend devient donc **rendue dynamiquement**, alors que le plan SEO prévoit du statique avec ISR pour le catalogue (`docs/06` §1.6).

Le compromis est acceptable tant qu'il n'y a qu'une entreprise, mais il **doit** être traité avant la mise en production, sinon l'objectif LCP < 2 s est hors de portée. Trois pistes, à trancher au lot 1 :

1. Mettre en cache la résolution du tenant avec `cacheLife`/`cacheTag` et n'invalider que sur modification des domaines — le plus simple.
2. Passer le tenant par un segment de route racine et `next/root-params`, ce qui permet la génération statique par entreprise.
3. En mono-entreprise, résoudre le tenant depuis une variable d'environnement au build et ne lire les en-têtes qu'en secours.

**Détail historique :** ce point s'appelait « middleware » dans les versions antérieures de Next. En Next 16, le fichier est `src/proxy.ts` et la fonction exportée `proxy` (§1.0). Il ne porte volontairement **pas** la résolution du tenant : il ne gère que le rafraîchissement de session et la protection des espaces authentifiés.

Middleware Next.js : `hostname` → `company_domains` → `company_id` mis en cache (`unstable_cache`, TTL 5 min) et injecté dans un contexte de requête. **Aucune requête base ne s'exécute sans `company_id` explicite**, y compris quand une seule entreprise existe. Un helper `getCompanyContext()` lève une exception si le tenant est absent.

---

## 5. Fonctions Postgres transactionnelles

Trois opérations ne doivent **jamais** être faites en lecture-puis-écriture applicative :

```sql
-- 1. Réserver le stock à la validation de commande (verrou de ligne)
create function reserve_stock(p_order_id uuid) returns void
-- SELECT ... FOR UPDATE sur chaque variante, vérifie stock_available ou allow_backorder,
-- incrémente stock_reserved, écrit dans stock_movements. Lève une exception si insuffisant.

-- 2. Réserver un créneau (double contrainte nombre + volume)
create function book_slot(p_order_id uuid, p_slot_id uuid) returns void
-- SELECT ... FOR UPDATE sur delivery_slots, vérifie booked_deliveries < max_deliveries
-- ET booked_volume_m3 + volume <= max_volume_m3. Lève une exception si complet.

-- 3. Générer la référence de commande / le numéro de facture (séquence sans trou)
create function next_order_reference(p_company_id uuid) returns text
create function next_invoice_number(p_company_id uuid) returns text
-- séquence par entreprise et par année, verrou d'advisory lock
```

Ces fonctions sont appelées via `supabase.rpc()` depuis les Server Actions. Elles constituent la seule frontière d'écriture pour le stock et les créneaux.

---

## 6. Variables d'environnement

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # serveur uniquement
# ImageKit
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=               # serveur uniquement
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=
# SMS (Lot 2)
SMS_PROVIDER_API_KEY=
# Divers
CRON_SECRET=                        # protège /api/cron/*
NEXT_PUBLIC_SITE_URL=
SENTRY_DSN=
GOOGLE_PLACES_API_KEY=              # avis Google + autocomplétion d'adresse
```

Un fichier `.env.example` documenté est versionné. Aucune valeur réelle n'entre dans le repo.
