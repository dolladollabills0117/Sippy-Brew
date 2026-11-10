-- Members can choose to put a bonus pass toward an order's overage. That bonus pass covers up to
-- the daily max of the overage (p_bonus_cover); the member confirms and pays only what's left.
-- The covered part counts as pass value, so the shop is paid for it like any pass.

alter table public.orders add column overage_bonus_pass_id uuid references public.bonus_passes (id);

drop function if exists public.place_order(uuid, uuid, uuid, timestamptz, integer, integer, integer, integer, date, jsonb, timestamptz, text, boolean);

create function public.place_order(
  p_member uuid,
  p_shop uuid,
  p_subscription uuid,
  p_period_start timestamptz,
  p_total integer,
  p_pass_covered integer,   -- today's pass + any bonus cover
  p_overage integer,        -- what the member pays (after any bonus cover)
  p_max_pass_value integer,
  p_pass_day date,
  p_items jsonb,
  p_pickup timestamptz,
  p_overage_payment_intent text,
  p_overage_confirmed boolean,
  p_bonus_cover integer     -- 0, or the overage a bonus pass covers: least(total - max, max)
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
  v_items_total integer;
  v_order uuid;
  v_bonus uuid;
  v_overage_bonus uuid;
  v_base integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_member::text, 0));

  select coalesce(sum((i ->> 'quantity')::int * (i ->> 'unit_price')::int), 0) into v_items_total
    from jsonb_array_elements(p_items) i;
  if v_items_total <> p_total or p_total <= 0 or p_pass_covered + p_overage <> p_total then
    raise exception 'ORDER_TOTAL_MISMATCH' using errcode = 'P0001';
  end if;
  v_base := least(p_total, p_max_pass_value);
  if coalesce(p_bonus_cover, 0) <> 0 and p_bonus_cover <> least(p_total - v_base, p_max_pass_value) then
    raise exception 'PASS_VALUE_MISMATCH' using errcode = 'P0001';
  end if;
  if p_bonus_cover > 0 and p_total <= v_base then
    raise exception 'PASS_VALUE_MISMATCH' using errcode = 'P0001';
  end if;
  if p_pass_covered <> v_base + coalesce(p_bonus_cover, 0) then
    raise exception 'PASS_VALUE_MISMATCH' using errcode = 'P0001';
  end if;
  if p_overage > 0 and not coalesce(p_overage_confirmed, false) then
    raise exception 'OVERAGE_CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  if exists (select 1 from orders where member_id = p_member and pass_day = p_pass_day and status <> 'cancelled') then
    raise exception 'PASS_USED_TODAY' using errcode = 'P0001';
  end if;

  -- Today's pass: this period's first, then the bonus pass that expires soonest.
  select coalesce(sum(passes), 0) into v_balance from pass_ledger
    where member_id = p_member and subscription_id = p_subscription and period_start = p_period_start;
  if v_balance < 1 then
    select id into v_bonus from bonus_passes
      where member_id = p_member and used < passes and expires_at > now()
      order by expires_at limit 1 for update;
    if v_bonus is null then
      raise exception 'NO_PASSES_LEFT' using errcode = 'P0001';
    end if;
  end if;

  -- The member's chosen bonus pass for the overage (never the same pass twice).
  if coalesce(p_bonus_cover, 0) > 0 then
    select id into v_overage_bonus from bonus_passes
      where member_id = p_member and expires_at > now()
        and passes - used - case when id = v_bonus then 1 else 0 end > 0
      order by expires_at limit 1 for update;
    if v_overage_bonus is null then
      raise exception 'BONUS_NOT_AVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  insert into orders (member_id, shop_id, subscription_id, period_start, total, pass_covered_amount, overage_amount, pass_day,
                      pickup_time, overage_confirmed_at, overage_payment_intent, overage_status, bonus_pass_id, overage_bonus_pass_id)
    values (p_member, p_shop, p_subscription, p_period_start, p_total, p_pass_covered, p_overage, p_pass_day,
            p_pickup, case when p_overage > 0 then now() end, p_overage_payment_intent,
            case when p_overage = 0 then 'none'::overage_status
                 when p_overage_payment_intent is null then 'waived'::overage_status
                 else 'authorized'::overage_status end,
            v_bonus, v_overage_bonus)
    returning id into v_order;

  insert into order_items (order_id, menu_item_id, name, size, quantity, unit_price, options)
    select v_order, (i ->> 'menu_item_id')::uuid, i ->> 'name', i ->> 'size', (i ->> 'quantity')::int, (i ->> 'unit_price')::int,
           coalesce(i -> 'options', '[]'::jsonb)
    from jsonb_array_elements(p_items) i;

  if v_bonus is null then
    insert into pass_ledger (member_id, subscription_id, period_start, passes, type, order_id, note)
      values (p_member, p_subscription, p_period_start, -1, 'use', v_order, 'Daily Pass');
  else
    update bonus_passes set used = used + 1 where id = v_bonus;
  end if;
  if v_overage_bonus is not null then
    update bonus_passes set used = used + 1 where id = v_overage_bonus;
  end if;

  return v_order;
end $$;

revoke execute on function public.place_order(uuid, uuid, uuid, timestamptz, integer, integer, integer, integer, date, jsonb, timestamptz, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, uuid, timestamptz, integer, integer, integer, integer, date, jsonb, timestamptz, text, boolean, integer) to service_role;

-- Cancel: both bonus passes (today's and the overage one) come back while they haven't expired.
create or replace function public.cancel_order(p_order uuid, p_refund boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if o.status in ('picked_up', 'cancelled') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  update orders set status = 'cancelled' where id = o.id;
  update redemptions set expires_at = least(expires_at, now()) where order_id = o.id and redeemed_at is null;
  if o.bonus_pass_id is not null then
    update bonus_passes set used = greatest(0, used - 1) where id = o.bonus_pass_id and expires_at > now();
  elsif p_refund then
    insert into pass_ledger (member_id, subscription_id, period_start, passes, type, order_id, note)
      values (o.member_id, o.subscription_id, o.period_start, 1, 'release', o.id, 'Order cancelled')
      on conflict do nothing;
  end if;
  if o.overage_bonus_pass_id is not null then
    update bonus_passes set used = greatest(0, used - 1) where id = o.overage_bonus_pass_id and expires_at > now();
  end if;
end $$;
