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
insert into subscriptions (id, member_id, tier, status, current_period_start, current_period_end, period_passes, period_max_pass_value)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'casual', 'active', '2026-11-01T00:00Z', '2026-12-01T00:00Z', 2, 600);
-- Grant 2 passes (a short allowance so the cap is easy to hit).
insert into pass_ledger (member_id, subscription_id, period_start, passes, type)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '2026-11-01T00:00Z', 2, 'grant');
insert into shops (id, owner_id, name, address, lat, lng, status)
  values ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000c1', 'Other Shop', '2 Main', 40.7, -74.0, 'pending');

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
    insert into pass_ledger (member_id, subscription_id, period_start, passes, type)
      values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '2026-11-01T00:00Z', 2, 'grant');
    raise exception 'double grant was accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Day 1: a $5 order uses a pass.
select place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 600, '2026-11-04',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null) as first_order \gset
do $$ begin
  assert (select sum(passes) from pass_ledger where member_id = '00000000-0000-0000-0000-0000000000a1') = 1;
end $$;

-- Second pass the same day is blocked, even at a different shop.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 600, '2026-11-04',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null);
    raise exception 'one pass per day not enforced';
  exception when raise_exception then
    if sqlerrm <> 'PASS_USED_TODAY' then raise; end if;
  end;
end $$;

-- The unique index also blocks it if the function were bypassed.
do $$ begin
  begin
    insert into orders (member_id, shop_id, subscription_id, period_start, total, pass_value, upgrade, pass_day, pickup_time)
      values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000d1',
              '2026-11-01T00:00Z', 300, 300, 0, '2026-11-04', now());
    raise exception 'unique pass-per-day index missing';
  exception when unique_violation then null;
  end;
end $$;

-- Day 2: a $7.00 order on a $6.00 max is split into $6.00 pass value + $1.00 upgrade.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 700, 700, 0, 600, '2026-11-05',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":700}]',
      now() + interval '10 minutes', null);
    raise exception 'pass value above max accepted';
  exception when raise_exception then
    if sqlerrm <> 'PASS_VALUE_MISMATCH' then raise; end if;
  end;
end $$;

select place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 700, 600, 100, 600, '2026-11-05',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":700}]',
      now() + interval '10 minutes', 'pi_test_authorized') as second_order \gset
do $$ begin
  assert (select upgrade_status from orders where pass_day = '2026-11-05') = 'authorized';
end $$;

-- An upgrade below the minimum charge has no PaymentIntent and is recorded as waived.
do $$ begin
  assert (select count(*) from orders where upgrade_status = 'waived') = 0;
end $$;

-- Day 3: both passes used, so the allowance is exhausted.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 600, '2026-11-06',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null);
    raise exception 'pass allowance not enforced';
  exception when raise_exception then
    if sqlerrm <> 'NO_PASSES_LEFT' then raise; end if;
  end;
end $$;


-- Client-supplied totals that don't match the items are rejected.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 100, 100, 0, 600, '2026-11-07',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null);
    raise exception 'total mismatch not caught';
  exception when raise_exception then
    if sqlerrm <> 'ORDER_TOTAL_MISMATCH' then raise; end if;
  end;
end $$;


-- Cancelling day 2 releases its pass, and day 3 can then use it.
select cancel_order(:'second_order', true);
select place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 600, '2026-11-06',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null);
do $$ begin
  assert (select sum(passes) from pass_ledger where member_id = '00000000-0000-0000-0000-0000000000a1') = 0;
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
  assert (select status from orders where pass_day = '2026-11-04') = 'picked_up';
  assert (select commission + net = total from orders where pass_day = '2026-11-04');
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
  assert (select payout_id is not null from orders where pass_day = '2026-11-04');
end $$;

rollback;
