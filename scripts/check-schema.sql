-- Exercises the atomic database functions. Run by scripts/check-schema.sh.
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'm@example.com', '{"name":"Mia Member"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'o@example.com', '{"name":"Owen Owner","role":"shop_owner"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'x@example.com', '{"name":"Sneaky","role":"admin"}');

do $$ begin
  assert (select role from profiles where email = 'o@example.com') = 'shop_owner';
  assert (select role from profiles where email = 'x@example.com') = 'member', 'sign-up must never grant admin';
end $$;

insert into shops (id, owner_id, name, address, lat, lng, status)
  values ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000b1', 'Test Shop', '1 Main', 40.7, -74.0, 'active');
insert into menu_items (id, shop_id, name, size, price, category)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000005a', 'Latte', '12 oz', 500, 'espresso');
insert into subscriptions (id, member_id, tier, status, current_period_start, current_period_end)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'sip', 'active', '2026-11-01T00:00Z', '2026-12-01T00:00Z');
insert into credit_ledger (member_id, subscription_id, period_start, amount, type)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '2026-11-01T00:00Z', 900, 'grant');

-- Food categories are impossible.
do $$ begin
  begin
    insert into menu_items (shop_id, name, size, price, category) values ('00000000-0000-0000-0000-00000000005a', 'Muffin', '1', 400, 'pastry');
    raise exception 'food category was accepted';
  exception when invalid_text_representation then null;
  end;
end $$;

-- Duplicate grant for the same period is rejected (webhook retry).
do $$ begin
  begin
    insert into credit_ledger (member_id, subscription_id, period_start, amount, type)
      values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '2026-11-01T00:00Z', 900, 'grant');
    raise exception 'double grant was accepted';
  exception when unique_violation then null;
  end;
end $$;

-- A $5 order within limits works and writes a spend.
select place_order(
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
  '2026-11-01T00:00Z', 500,
  '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
  now() + interval '10 minutes', now() - interval '1 hour', now() + interval '1 hour', 800) as first_order \gset

do $$ begin
  assert (select sum(amount) from credit_ledger where member_id = '00000000-0000-0000-0000-0000000000a1') = 400;
end $$;

-- A second $5 order the same day breaks the $8 daily limit.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500,
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', now() - interval '1 hour', now() + interval '1 hour', 800);
    raise exception 'daily limit not enforced';
  exception when raise_exception then
    if sqlerrm <> 'DAILY_LIMIT' then raise; end if;
  end;
end $$;

-- Next day (new day window): $5 is over the $4 credit left.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500,
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', now() + interval '1 day', now() + interval '2 days', 800);
    raise exception 'credit cap not enforced';
  exception when raise_exception then
    if sqlerrm <> 'CREDIT_CAP' then raise; end if;
  end;
end $$;

-- Client-supplied totals that don't match the items are rejected.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 100,
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', now() + interval '1 day', now() + interval '2 days', 800);
    raise exception 'total mismatch not caught';
  exception when raise_exception then
    if sqlerrm <> 'ORDER_TOTAL_MISMATCH' then raise; end if;
  end;
end $$;

-- QR: an expired code fails, a live code works once.
insert into redemptions (id, order_id, qr_token, short_code, expires_at) values
  ('00000000-0000-0000-0000-000000000f01', :'first_order', 'expired-token', 'AAAAAA', now() - interval '1 second'),
  ('00000000-0000-0000-0000-000000000f02', :'first_order', 'live-token', 'BBBBBB', now() + interval '30 seconds');

do $$ begin
  begin
    perform redeem_qr('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-00000000005a', null, 60, 440);
    raise exception 'expired QR accepted';
  exception when raise_exception then
    if sqlerrm <> 'EXPIRED' then raise; end if;
  end;
end $$;

select redeem_qr('00000000-0000-0000-0000-000000000f02', '00000000-0000-0000-0000-00000000005a', null, 60, 440);

do $$ begin
  assert (select status from orders limit 1) = 'picked_up';
  assert (select commission + net = total from orders limit 1);
  begin
    perform redeem_qr('00000000-0000-0000-0000-000000000f02', '00000000-0000-0000-0000-00000000005a', null, 60, 440);
    raise exception 'QR redeemed twice';
  exception when raise_exception then
    if sqlerrm <> 'ALREADY_REDEEMED' then raise; end if;
  end;
end $$;

-- One post per shop per day.
insert into posts (shop_id, body, post_day) values ('00000000-0000-0000-0000-00000000005a', 'Pumpkin today', '2026-11-04');
do $$ begin
  begin
    insert into posts (shop_id, body, post_day) values ('00000000-0000-0000-0000-00000000005a', 'Second post', '2026-11-04');
    raise exception 'second post accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Payout ties orders to the payout and checks the sum.
select create_payout('00000000-0000-0000-0000-00000000005a', now() - interval '7 days', now(), array[:'first_order']::uuid[], 500, 60, 440);
do $$ begin
  assert (select payout_id is not null from orders limit 1);
end $$;

rollback;
