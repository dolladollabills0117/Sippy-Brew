-- Commission: founding shops pay 12% on pass value (locked in), everyone else 15%; every shop
-- pays 5% on overages (rules.json). Rates are applied by the app; the database stores each
-- order's amounts and checks that payouts add up.

alter table public.shops add column founding boolean not null default false;
-- Shops already on the platform before this change are founding shops.
update public.shops set founding = true;

-- Sippy Brew's 5% of a charged overage, recorded when the overage is captured.
alter table public.orders add column overage_commission integer not null default 0;
alter table public.orders add constraint orders_overage_split_check
  check (overage_commission >= 0 and overage_fee + overage_commission <= overage_amount);

alter table public.payouts add column overage_commission integer not null default 0;

drop function if exists public.create_payout(uuid, timestamptz, timestamptz, uuid[], integer, integer, integer, integer, integer);

create function public.create_payout(
  p_shop uuid, p_start timestamptz, p_end timestamptz, p_order_ids uuid[],
  p_gross integer, p_commission integer, p_net integer, p_overage_total integer, p_processing_fees integer,
  p_overage_commission integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pass integer; v_over integer; v_fees integer; v_cut integer; v_comm integer;
begin
  select coalesce(sum(pass_covered_amount), 0), coalesce(sum(overage_amount), 0), coalesce(sum(overage_fee), 0),
         coalesce(sum(overage_commission), 0), coalesce(sum(commission), 0)
    into v_pass, v_over, v_fees, v_cut, v_comm from orders
    where id = any (p_order_ids) and shop_id = p_shop and status in ('picked_up', 'no_show') and payout_id is null;
  if v_pass <> p_gross or v_over <> p_overage_total or v_fees <> p_processing_fees
     or v_cut <> p_overage_commission or v_comm <> p_commission or p_commission + p_net <> p_gross then
    raise exception 'PAYOUT_MISMATCH' using errcode = 'P0001';
  end if;
  insert into payouts (shop_id, period_start, period_end, gross, commission, net, overage_total, processing_fees, overage_commission, order_count)
    values (p_shop, p_start, p_end, p_gross, p_commission, p_net, p_overage_total, p_processing_fees, p_overage_commission, coalesce(array_length(p_order_ids, 1), 0))
    returning id into v_id;
  update orders set payout_id = v_id where id = any (p_order_ids);
  return v_id;
end $$;

revoke execute on function public.create_payout(uuid, timestamptz, timestamptz, uuid[], integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.create_payout(uuid, timestamptz, timestamptz, uuid[], integer, integer, integer, integer, integer, integer) to service_role;
