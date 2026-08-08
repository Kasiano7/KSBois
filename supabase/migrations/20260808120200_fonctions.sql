-- =============================================================================
-- 0003 — Fonctions transactionnelles
-- Référence : docs/01-ARCHITECTURE.md §5
--
-- Stock, créneaux et numérotation ne doivent JAMAIS être manipulés en
-- lecture-puis-écriture depuis le serveur applicatif : deux clients simultanés
-- vendraient le même dernier stère. Tout passe par ces fonctions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Numérotation — séquence par entreprise et par année, sans trou.
-- -----------------------------------------------------------------------------
create or replace function next_document_number(p_company_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now() at time zone 'Europe/Paris');
  v_value integer;
  v_prefix text;
begin
  -- Verrou d'avis : sérialise les appels concurrents pour cette entreprise+type.
  perform pg_advisory_xact_lock(hashtext(p_company_id::text || p_kind));

  insert into document_sequences (company_id, kind, year, last_value)
  values (p_company_id, p_kind, v_year, 1)
  on conflict (company_id, kind, year)
    do update set last_value = document_sequences.last_value + 1
  returning last_value into v_value;

  v_prefix := case p_kind
    when 'order' then 'CMD'
    when 'invoice' then 'FAC'
    when 'quote' then 'DEV'
    else 'DOC'
  end;

  return format('%s-%s-%s', v_prefix, v_year, lpad(v_value::text, 4, '0'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Mouvement de stock — point d'écriture UNIQUE sur stock_on_hand.
-- -----------------------------------------------------------------------------
create or replace function apply_stock_movement(
  p_variant_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_order_id uuid default null,
  p_reason text default null,
  p_actor uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant product_variants%rowtype;
  v_after numeric(12,3);
begin
  select * into v_variant from product_variants
    where id = p_variant_id for update;

  if not found then
    raise exception 'Variante introuvable : %', p_variant_id
      using errcode = 'no_data_found';
  end if;

  case p_movement_type
    when 'production' then
      update product_variants set stock_on_hand = stock_on_hand + p_quantity
        where id = p_variant_id returning stock_on_hand into v_after;

    when 'adjustment' then
      -- p_quantity est ici la valeur CIBLE, pas un delta.
      update product_variants set stock_on_hand = p_quantity
        where id = p_variant_id returning stock_on_hand into v_after;

    when 'loss' then
      update product_variants set stock_on_hand = stock_on_hand - abs(p_quantity)
        where id = p_variant_id returning stock_on_hand into v_after;

    when 'reservation' then
      update product_variants set stock_reserved = stock_reserved + p_quantity
        where id = p_variant_id returning stock_on_hand into v_after;

    when 'release' then
      update product_variants set stock_reserved = greatest(0, stock_reserved - p_quantity)
        where id = p_variant_id returning stock_on_hand into v_after;

    when 'shipment' then
      update product_variants
        set stock_on_hand = stock_on_hand - p_quantity,
            stock_reserved = greatest(0, stock_reserved - p_quantity)
        where id = p_variant_id returning stock_on_hand into v_after;

    else
      raise exception 'Type de mouvement inconnu : %', p_movement_type;
  end case;

  insert into stock_movements (
    company_id, variant_id, movement_type, quantity, stock_after,
    order_id, reason, created_by
  ) values (
    v_variant.company_id, p_variant_id, p_movement_type, p_quantity, v_after,
    p_order_id, p_reason, p_actor
  );

  return v_after;
end;
$$;

-- -----------------------------------------------------------------------------
-- Réservation du stock d'une commande. Atomique : tout ou rien.
-- -----------------------------------------------------------------------------
create or replace function reserve_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_variant product_variants%rowtype;
begin
  for r in
    select oi.variant_id, oi.quantity, oi.product_name, oi.variant_label
    from order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    -- Ordre stable : évite les interblocages entre commandes concurrentes.
    order by oi.variant_id
  loop
    select * into v_variant from product_variants
      where id = r.variant_id for update;

    if v_variant.track_stock
       and not v_variant.allow_backorder
       and (v_variant.stock_on_hand - v_variant.stock_reserved) < r.quantity then
      raise exception 'Stock insuffisant pour % (%) : % demandés, % disponibles',
        r.product_name, r.variant_label, r.quantity,
        (v_variant.stock_on_hand - v_variant.stock_reserved)
        using errcode = 'check_violation';
    end if;

    if v_variant.track_stock then
      perform apply_stock_movement(r.variant_id, 'reservation', r.quantity, p_order_id);
    end if;
  end loop;
end;
$$;

create or replace function release_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select oi.variant_id, oi.quantity from order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    order by oi.variant_id
  loop
    perform apply_stock_movement(r.variant_id, 'release', r.quantity, p_order_id);
  end loop;
end;
$$;

create or replace function ship_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select oi.variant_id, oi.quantity from order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    order by oi.variant_id
  loop
    perform apply_stock_movement(r.variant_id, 'shipment', r.quantity, p_order_id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Réservation de créneau — DOUBLE contrainte : nombre ET volume.
-- C'est le point que la plupart des sites ratent (docs/02 §3.2).
-- -----------------------------------------------------------------------------
create or replace function book_slot(p_order_id uuid, p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot delivery_slots%rowtype;
  v_volume numeric(10,3);
begin
  select total_volume_m3 into v_volume from orders where id = p_order_id;
  if not found then
    raise exception 'Commande introuvable : %', p_order_id;
  end if;

  select * into v_slot from delivery_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Créneau introuvable : %', p_slot_id;
  end if;

  if not v_slot.is_open then
    raise exception 'Ce créneau est fermé.' using errcode = 'check_violation';
  end if;

  if v_slot.booked_deliveries + 1 > v_slot.max_deliveries then
    raise exception 'Ce créneau est complet (nombre de livraisons).'
      using errcode = 'check_violation';
  end if;

  if v_slot.booked_volume_m3 + v_volume > v_slot.max_volume_m3 then
    raise exception 'Ce créneau est complet (volume) : % m³ restants, % demandés.',
      (v_slot.max_volume_m3 - v_slot.booked_volume_m3), v_volume
      using errcode = 'check_violation';
  end if;

  update delivery_slots
    set booked_deliveries = booked_deliveries + 1,
        booked_volume_m3 = booked_volume_m3 + v_volume
    where id = p_slot_id;

  update orders set slot_id = p_slot_id where id = p_order_id;
end;
$$;

create or replace function release_slot(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id;
  if v_order.slot_id is null then return; end if;

  update delivery_slots
    set booked_deliveries = greatest(0, booked_deliveries - 1),
        booked_volume_m3 = greatest(0, booked_volume_m3 - v_order.total_volume_m3)
    where id = v_order.slot_id;

  update orders set slot_id = null where id = p_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Génération des créneaux à partir des modèles récurrents (cron hebdomadaire).
-- Idempotent : réexécuter ne crée pas de doublon.
-- -----------------------------------------------------------------------------
create or replace function generate_delivery_slots(
  p_company_id uuid,
  p_horizon_days integer default 45
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t slot_templates%rowtype;
  d date;
  v_created integer := 0;
begin
  for t in select * from slot_templates
           where company_id = p_company_id and is_active
  loop
    d := current_date;
    while d <= current_date + p_horizon_days loop
      if extract(isodow from d) = t.weekday
         and not exists (
           select 1 from slot_blackouts b
           where b.company_id = p_company_id
             and d between b.start_date and b.end_date
             and (cardinality(b.applies_to_zone_ids) = 0
                  or b.applies_to_zone_ids && t.zone_ids)
         )
      then
        insert into delivery_slots (
          company_id, template_id, date, start_time, end_time, label,
          max_deliveries, max_volume_m3, vehicle_id, zone_ids
        ) values (
          p_company_id, t.id, d, t.start_time, t.end_time, t.label,
          t.max_deliveries, t.max_volume_m3, t.vehicle_id, t.zone_ids
        )
        on conflict (company_id, date, start_time, end_time) do nothing;

        if found then v_created := v_created + 1; end if;
      end if;
      d := d + 1;
    end loop;
  end loop;

  return v_created;
end;
$$;
