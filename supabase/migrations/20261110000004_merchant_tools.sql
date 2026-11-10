-- Merchant tools: no-shows, order notes with allergies, menu price-change dates, and alerts
-- for the Sippy Brew team.

-- Order notes. allergy_note is shown to the shop as a big red ALLERGY NOTICE.
alter table public.orders add column note text check (note is null or char_length(note) <= 200);
alter table public.orders add column allergy_note text check (allergy_note is null or char_length(allergy_note) <= 200);

-- No-shows. redeemed_at doubles as the settlement time (pickup or no-show) for payouts.
alter table public.orders add column no_show_at timestamptz;
alter table public.orders add column no_show_by uuid references public.profiles (id);
drop index if exists public.orders_unpaid_idx;
create index orders_unpaid_idx on public.orders (shop_id, redeemed_at) where status in ('picked_up', 'no_show') and payout_id is null;

-- When a shop changes a price, members see "price updated" for a while.
alter table public.menu_items add column price_changed_at timestamptz;
create or replace function public.touch_menu_price() returns trigger language plpgsql as $$
begin
  if new.price is distinct from old.price then new.price_changed_at = now(); end if;
  return new;
end $$;
create trigger menu_items_price_changed before update of price on public.menu_items
  for each row execute function public.touch_menu_price();

-- Alerts for the Sippy Brew team (shown on the admin page): no-shows for now.
create table public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  order_id uuid references public.orders (id) on delete set null,
  shop_id uuid references public.shops (id) on delete set null,
  member_id uuid references public.profiles (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index platform_alerts_open_idx on public.platform_alerts (created_at desc) where resolved_at is null;
alter table public.platform_alerts enable row level security;
create policy alerts_admin on public.platform_alerts for select using (public.is_admin());

-- Flag an order as not picked up. Allowed once the pickup time is p_grace_minutes in the past.
-- No refund: the pass stays used and the shop is paid for it like a pickup (commission + net).
create or replace function public.flag_no_show(
  p_order uuid,
  p_shop uuid,
  p_staff uuid,
  p_commission integer,
  p_net integer,
  p_grace_minutes integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if o.shop_id <> p_shop then raise exception 'WRONG_SHOP' using errcode = 'P0001'; end if;
  if o.status not in ('received', 'preparing', 'ready') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if o.pickup_time + make_interval(mins => p_grace_minutes) > now() then raise exception 'TOO_EARLY' using errcode = 'P0001'; end if;
  if p_commission + p_net <> o.pass_covered_amount then raise exception 'SPLIT_MISMATCH' using errcode = 'P0001'; end if;

  update orders set status = 'no_show', no_show_at = now(), no_show_by = p_staff, redeemed_at = now(),
                    commission = p_commission, net = p_net
    where id = o.id;
  update redemptions set expires_at = least(expires_at, now()) where order_id = o.id and redeemed_at is null;
  insert into platform_alerts (kind, order_id, shop_id, member_id, message)
    values ('no_show', o.id, o.shop_id, o.member_id, 'Order not picked up');
  return o.id;
end $$;
revoke execute on function public.flag_no_show(uuid, uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.flag_no_show(uuid, uuid, uuid, integer, integer, integer) to service_role;

-- Payouts include no-shows (the shop made the drink and is paid for it).
create or replace function public.create_payout(
  p_shop uuid, p_start timestamptz, p_end timestamptz, p_order_ids uuid[],
  p_gross integer, p_commission integer, p_net integer, p_overage_total integer, p_processing_fees integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pass integer; v_over integer; v_fees integer;
begin
  select coalesce(sum(pass_covered_amount), 0), coalesce(sum(overage_amount), 0), coalesce(sum(overage_fee), 0)
    into v_pass, v_over, v_fees from orders
    where id = any (p_order_ids) and shop_id = p_shop and status in ('picked_up', 'no_show') and payout_id is null;
  if v_pass <> p_gross or v_over <> p_overage_total or v_fees <> p_processing_fees then
    raise exception 'PAYOUT_MISMATCH' using errcode = 'P0001';
  end if;
  insert into payouts (shop_id, period_start, period_end, gross, commission, net, overage_total, processing_fees, order_count)
    values (p_shop, p_start, p_end, p_gross, p_commission, p_net, p_overage_total, p_processing_fees, coalesce(array_length(p_order_ids, 1), 0))
    returning id into v_id;
  update orders set payout_id = v_id where id = any (p_order_ids);
  return v_id;
end $$;

-- A no-show is final: it can't be cancelled (which would return the pass).
create or replace function public.cancel_order(p_order uuid, p_refund boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if o.status in ('picked_up', 'cancelled', 'no_show') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
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
