-- An order can be cancelled (and its pass returned) only before the shop marks it as being
-- prepared. After that, an order that isn't collected is a no-show.
create or replace function public.cancel_order(p_order uuid, p_refund boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  -- Only before the shop marks it preparing.
  if o.status <> 'received' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
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
