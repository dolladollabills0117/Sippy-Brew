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
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'affogato_double_shot', 'active', '2026-11-01T00:00Z', '2026-12-01T00:00Z', 2, 800);
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
      '2026-11-01T00:00Z', 500, 500, 0, 800, '2026-11-04',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 0) as first_order \gset
do $$ begin
  assert (select sum(passes) from pass_ledger where member_id = '00000000-0000-0000-0000-0000000000a1') = 1;
end $$;

-- Second pass the same day is blocked, even at a different shop.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 800, '2026-11-04',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 0);
    raise exception 'one pass per day not enforced';
  exception when raise_exception then
    if sqlerrm <> 'PASS_USED_TODAY' then raise; end if;
  end;
end $$;

-- The unique index also blocks it if the function were bypassed.
do $$ begin
  begin
    insert into orders (member_id, shop_id, subscription_id, period_start, total, pass_covered_amount, overage_amount, pass_day, pickup_time)
      values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000d1',
              '2026-11-01T00:00Z', 300, 300, 0, '2026-11-04', now());
    raise exception 'unique pass-per-day index missing';
  exception when unique_violation then null;
  end;
end $$;

-- Day 2: a $9.50 order with an $8.00 max: $8.00 pass-covered + $1.50 overage.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 950, 950, 0, 800, '2026-11-05',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":950}]',
      now() + interval '10 minutes', null, false, 0);
    raise exception 'pass value above max accepted';
  exception when raise_exception then
    if sqlerrm <> 'PASS_VALUE_MISMATCH' then raise; end if;
  end;
end $$;

-- The same order without the member's confirmation is refused.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 950, 800, 150, 800, '2026-11-05',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":950}]',
      now() + interval '10 minutes', 'pi_test_authorized', false, 0);
    raise exception 'overage charged without confirmation';
  exception when raise_exception then
    if sqlerrm <> 'OVERAGE_CONFIRMATION_REQUIRED' then raise; end if;
  end;
end $$;

select place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 950, 800, 150, 800, '2026-11-05',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":950}]',
      now() + interval '10 minutes', 'pi_test_authorized', true, 0) as second_order \gset
do $$ begin
  assert (select overage_status from orders where pass_day = '2026-11-05') = 'authorized';
  assert (select overage_confirmed_at is not null from orders where pass_day = '2026-11-05');
end $$;

-- No waived overages so far.
do $$ begin
  assert (select count(*) from orders where overage_status = 'waived') = 0;
end $$;

-- Day 3: both passes used, so the allowance is exhausted.
do $$ begin
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 800, '2026-11-06',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 0);
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
      '2026-11-01T00:00Z', 100, 100, 0, 800, '2026-11-07',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 0);
    raise exception 'total mismatch not caught';
  exception when raise_exception then
    if sqlerrm <> 'ORDER_TOTAL_MISMATCH' then raise; end if;
  end;
end $$;


-- Cancelling day 2 releases its pass, and day 3 can then use it.
select cancel_order(:'second_order', true);
select place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 800, '2026-11-06',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 0);
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
select create_payout('00000000-0000-0000-0000-00000000005a', now() - interval '7 days', now(), array[:'first_order']::uuid[], 500, 60, 440, 0, 0);
do $$ begin
  assert (select payout_id is not null from orders where pass_day = '2026-11-04');
end $$;

-- Rewards: referral codes and links.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'friend@example.com',
   json_build_object('name', 'Fran Friend', 'ref', lower((select referral_code from profiles where id = '00000000-0000-0000-0000-0000000000a1')))::jsonb);
do $$ begin
  assert (select referral_code ~ '^SB-[A-HJ-NP-Z2-9]{6}$' from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'referral code format';
  assert (select referred_by from profiles where id = '00000000-0000-0000-0000-0000000000a2') = '00000000-0000-0000-0000-0000000000a1', 'friend linked to referrer';
  assert (select count(distinct referral_code) = count(*) from profiles), 'codes are unique';
  begin
    update profiles set referred_by = id where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'self-referral accepted';
  exception when check_violation then null;
  end;
end $$;

-- Shops get live_since when they go live.
do $$ begin
  assert (select live_since is not null from shops where id = '00000000-0000-0000-0000-00000000005a');
  assert (select live_since is null from shops where id = '00000000-0000-0000-0000-00000000005b');
end $$;
update shops set status = 'active' where id = '00000000-0000-0000-0000-00000000005b';
do $$ begin assert (select live_since is not null from shops where id = '00000000-0000-0000-0000-00000000005b'); end $$;

-- Bonus passes: with this period's passes used up, an order uses the unexpired bonus that
-- expires soonest; expired bonuses never count; cancelling gives the bonus pass back.
insert into bonus_passes (id, member_id, source, source_key, passes, granted_at, expires_at) values
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a1', 'referral', 'referral-0', 3, now() - interval '400 days', now() - interval '35 days'),
  ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', 'referral', 'referral-1', 3, now() - interval '10 days', now() + interval '355 days'),
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000a1', 'passport', 'passport', 1, now() - interval '200 days', now() + interval '165 days');
do $$ begin
  assert (select coalesce(sum(passes), 0) from pass_ledger where member_id = '00000000-0000-0000-0000-0000000000a1') = 0, 'period passes used up';
  begin
    insert into bonus_passes (member_id, source, source_key, passes, expires_at) values ('00000000-0000-0000-0000-0000000000a1', 'passport', 'passport', 1, now() + interval '1 year');
    raise exception 'passport reward given twice';
  exception when unique_violation then null;
  end;
end $$;
select place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 500, 500, 0, 800, '2026-11-08',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":1,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 0) as bonus_order \gset
do $$ begin
  assert (select bonus_pass_id from orders where pass_day = '2026-11-08') = '00000000-0000-0000-0000-0000000000bb', 'soonest-expiring bonus used';
  assert (select used from bonus_passes where id = '00000000-0000-0000-0000-0000000000bb') = 1;
  assert (select used from bonus_passes where id = '00000000-0000-0000-0000-0000000000b9') = 0, 'expired bonus untouched';
  assert (select coalesce(sum(passes), 0) from pass_ledger where member_id = '00000000-0000-0000-0000-0000000000a1') = 0, 'no period pass used';
end $$;
select cancel_order(:'bonus_order', false);
do $$ begin
  assert (select used from bonus_passes where id = '00000000-0000-0000-0000-0000000000bb') = 0, 'bonus pass returned on cancel';
end $$;

-- The member chooses to put a bonus pass toward the overage: $10 on an $8 pass = $2 over, all
-- covered by a second bonus pass. Today's pass is the soonest-expiring bonus (bb); the overage
-- bonus can't be the same pass, so it comes from ba. Cancelling returns both.
select place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 1000, 1000, 0, 800, '2026-11-09',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":2,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 200) as ob_order \gset
do $$ begin
  assert (select bonus_pass_id from orders where pass_day = '2026-11-09') = '00000000-0000-0000-0000-0000000000bb';
  assert (select overage_bonus_pass_id from orders where pass_day = '2026-11-09') = '00000000-0000-0000-0000-0000000000ba';
  assert (select used from bonus_passes where id = '00000000-0000-0000-0000-0000000000ba') = 1;
  assert (select overage_amount = 0 and pass_covered_amount = 1000 from orders where pass_day = '2026-11-09');
  begin
    perform place_order(
      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1',
      '2026-11-01T00:00Z', 1000, 1000, 0, 800, '2026-11-10',
      '[{"menu_item_id":"00000000-0000-0000-0000-0000000000e1","name":"Latte","size":"12 oz","quantity":2,"unit_price":500}]',
      now() + interval '10 minutes', null, false, 150);
    raise exception 'wrong bonus cover accepted';
  exception when raise_exception then
    if sqlerrm <> 'PASS_VALUE_MISMATCH' then raise; end if;
  end;
end $$;
select cancel_order(:'ob_order', false);
do $$ begin
  assert (select used from bonus_passes where id = '00000000-0000-0000-0000-0000000000ba') = 0, 'overage bonus returned';
  assert (select used from bonus_passes where id = '00000000-0000-0000-0000-0000000000bb') = 0, 'day bonus returned';
end $$;

rollback;
