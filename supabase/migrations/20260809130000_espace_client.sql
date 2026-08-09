-- =============================================================================
-- Espace client — rattachement des commandes à une fiche client
--
-- Constat à l'origine de cette migration : le tunnel enregistrait les commandes
-- avec l'email et le nom du client, mais SANS jamais créer de ligne `customers`
-- ni renseigner `orders.customer_id`. Conséquence : la policy
-- `orders_customer_read` (qui filtre sur `current_customer_id`) ne rendait
-- jamais aucune ligne, et l'espace client aurait été vide pour tout le monde.
--
-- Deux fonctions, toutes deux transactionnelles et idempotentes :
--   • `upsert_customer`      — trouve ou crée la fiche client d'une commande ;
--   • `rattacher_client_au_compte` — relie les commandes invité passées au
--     compte qui vient d'être créé, en s'appuyant sur l'adresse email.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fiche client d'une commande.
--
-- L'unicité est portée par l'index `customers (company_id, lower(email))` :
-- deux commandes passées avec la même adresse rejoignent la même fiche, ce qui
-- est exactement ce qu'attend l'exploitant quand il ouvre un client.
-- -----------------------------------------------------------------------------
create or replace function upsert_customer(
  p_company_id uuid,
  p_email text,
  p_first_name text default null,
  p_last_name text default null,
  p_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'Une fiche client exige une adresse email.';
  end if;

  select id into v_id
    from customers
   where company_id = p_company_id and lower(email) = lower(btrim(p_email))
   for update;

  if v_id is null then
    insert into customers (company_id, email, first_name, last_name, phone)
      values (p_company_id, btrim(p_email), p_first_name, p_last_name, p_phone)
      returning id into v_id;
    return v_id;
  end if;

  -- Fiche existante : on complète les champs vides sans jamais écraser une
  -- information déjà saisie par l'exploitant.
  update customers
     set first_name = coalesce(first_name, p_first_name),
         last_name  = coalesce(last_name, p_last_name),
         phone      = coalesce(phone, p_phone)
   where id = v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rattachement d'un compte authentifié à sa fiche client.
--
-- Appelée à la première visite de l'espace client. Elle fait deux choses que
-- l'on ne peut pas séparer sans risquer un état incohérent :
--   1. poser `user_id` sur la fiche portant cette adresse (ou la créer) ;
--   2. rattacher les commandes passées EN INVITÉ avec la même adresse.
--
-- ⚠️ Le rattachement se fait sur l'email VÉRIFIÉ par Supabase Auth, jamais sur
-- une valeur transmise par le navigateur : c'est ce qui empêche de réclamer les
-- commandes d'un tiers en saisissant son adresse.
-- -----------------------------------------------------------------------------
create or replace function rattacher_client_au_compte(
  p_company_id uuid,
  p_user_id uuid,
  p_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  -- ⚠️ `customers.user_id` référence `profiles`, PAS `auth.users`. Un compte
  -- créé par lien magique n'a encore aucun profil : sans cette ligne, le
  -- rattachement échoue sur la contrainte de clé étrangère et le client se
  -- retrouve renvoyé à l'écran de connexion sans la moindre explication.
  insert into profiles (id, email)
    values (p_user_id, btrim(p_email))
    on conflict (id) do nothing;

  v_customer_id := upsert_customer(p_company_id, p_email);

  update customers
     set user_id = p_user_id
   where id = v_customer_id
     and (user_id is null or user_id = p_user_id);

  -- Commandes invité de la même adresse, encore orphelines.
  update orders
     set customer_id = v_customer_id
   where company_id = p_company_id
     and customer_id is null
     and lower(email) = lower(btrim(p_email));

  return v_customer_id;
end;
$$;

-- Ces fonctions écrivent : réservées au serveur.
revoke all on function upsert_customer(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function rattacher_client_au_compte(uuid, uuid, text) from public, anon, authenticated;
grant execute on function upsert_customer(uuid, text, text, text, text) to service_role;
grant execute on function rattacher_client_au_compte(uuid, uuid, text) to service_role;

-- Index de lecture de l'espace client : « mes commandes, les plus récentes
-- d'abord » est la requête la plus fréquente de cet espace.
create index if not exists orders_customer_idx
  on orders (company_id, customer_id, created_at desc)
  where customer_id is not null;
