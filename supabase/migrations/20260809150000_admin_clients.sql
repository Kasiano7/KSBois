-- Administration clients : motif de blocage, anonymisation RGPD et fusion atomique.

alter table customers
  add column blocked_reason text,
  add column anonymized_at timestamptz;

create or replace function merge_customers(
  p_company_id uuid,
  p_source_id uuid,
  p_target_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source customers%rowtype;
  v_target customers%rowtype;
begin
  if p_source_id = p_target_id then
    raise exception 'Les deux fiches doivent être différentes';
  end if;

  select * into v_source from customers
    where id = p_source_id and company_id = p_company_id for update;
  select * into v_target from customers
    where id = p_target_id and company_id = p_company_id for update;
  if v_source.id is null or v_target.id is null then
    raise exception 'Fiche client introuvable';
  end if;
  if v_source.anonymized_at is not null or v_target.anonymized_at is not null then
    raise exception 'Une fiche anonymisée ne peut pas être fusionnée';
  end if;
  if v_source.user_id is not null and v_target.user_id is not null
     and v_source.user_id <> v_target.user_id then
    raise exception 'Ces fiches appartiennent à deux comptes clients différents';
  end if;

  update orders set customer_id = p_target_id
    where company_id = p_company_id and customer_id = p_source_id;
  update addresses set customer_id = p_target_id
    where company_id = p_company_id and customer_id = p_source_id;
  update carts set customer_id = p_target_id
    where company_id = p_company_id and customer_id = p_source_id;

  update customers set
    user_id = coalesce(v_target.user_id, v_source.user_id),
    phone = coalesce(v_target.phone, v_source.phone),
    first_name = coalesce(v_target.first_name, v_source.first_name),
    last_name = coalesce(v_target.last_name, v_source.last_name),
    is_company = v_target.is_company or v_source.is_company,
    company_name = coalesce(v_target.company_name, v_source.company_name),
    siret = coalesce(v_target.siret, v_source.siret),
    vat_number = coalesce(v_target.vat_number, v_source.vat_number),
    customer_type = case
      when v_target.customer_type = 'professionnel' or v_source.customer_type = 'professionnel'
        then 'professionnel' else 'particulier' end,
    internal_notes = nullif(concat_ws(E'\n\n', v_target.internal_notes, v_source.internal_notes), ''),
    accepts_marketing = v_target.accepts_marketing or v_source.accepts_marketing,
    is_blocked = v_target.is_blocked or v_source.is_blocked,
    blocked_reason = coalesce(v_target.blocked_reason, v_source.blocked_reason),
    total_orders = (
      select count(*) from orders
      where company_id = p_company_id and customer_id = p_target_id and status <> 'annulee'
    ),
    total_spent_cents = (
      select coalesce(sum(total_cents), 0) from orders
      where company_id = p_company_id and customer_id = p_target_id and status <> 'annulee'
    )
  where id = p_target_id and company_id = p_company_id;

  delete from customers where id = p_source_id and company_id = p_company_id;
end;
$$;

create or replace function anonymize_customer(
  p_company_id uuid,
  p_customer_id uuid
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_customer customers%rowtype;
  v_email citext;
begin
  select * into v_customer from public.customers
    where id = p_customer_id and company_id = p_company_id for update;
  if v_customer.id is null then raise exception 'Fiche client introuvable'; end if;
  if v_customer.anonymized_at is not null then raise exception 'Fiche déjà anonymisée'; end if;

  v_email := ('anonymise+' || replace(p_customer_id::text, '-', '') || '@invalid.local')::citext;

  delete from public.addresses
    where company_id = p_company_id and customer_id = p_customer_id;

  update public.orders set
    email = v_email,
    phone = null,
    first_name = 'Client',
    last_name = 'anonymisé',
    shipping_address = null,
    delivery_notes = null,
    internal_notes = null
  where company_id = p_company_id and customer_id = p_customer_id;

  update public.quote_requests set
    email = v_email,
    phone = null,
    first_name = 'Client',
    last_name = 'anonymisé',
    company_name = null,
    address_line1 = null,
    postal_code = null,
    city = null,
    message = null,
    admin_notes = null
  where company_id = p_company_id and lower(email::text) = lower(v_customer.email::text);

  update public.customers set
    user_id = null,
    email = v_email,
    phone = null,
    first_name = 'Client',
    last_name = 'anonymisé',
    is_company = false,
    company_name = null,
    siret = null,
    vat_number = null,
    customer_type = 'particulier',
    internal_notes = null,
    is_blocked = true,
    blocked_reason = 'Données personnelles anonymisées',
    accepts_marketing = false,
    anonymized_at = now()
  where id = p_customer_id and company_id = p_company_id;

  if v_customer.user_id is not null
     and not exists (select 1 from public.company_members where user_id = v_customer.user_id) then
    delete from auth.users where id = v_customer.user_id;
  end if;
end;
$$;

revoke all on function merge_customers(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function anonymize_customer(uuid, uuid) from public, anon, authenticated;
grant execute on function merge_customers(uuid, uuid, uuid) to service_role;
grant execute on function anonymize_customer(uuid, uuid) to service_role;
