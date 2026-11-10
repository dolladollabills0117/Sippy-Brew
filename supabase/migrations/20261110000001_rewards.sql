-- Rewards: Neighborhood Passport, Grand Tour and referrals (rules in packages/core/src/rules/rewards.ts).
--
-- Bonus passes work like Daily Passes but roll over: each grant expires a year after it's earned
-- (RULES.bonusPassLifetimeDays) instead of at renewal. Orders use this period's passes first,
-- then the bonus grant that expires soonest. Shops are paid for a bonus pass like any pass.

create type public.bonus_source as enum ('passport', 'referral');

create table public.bonus_passes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  source public.bonus_source not null,
  -- Makes each reward idempotent: 'passport', 'referral-1', 'referral-2', ...
  source_key text not null,
  passes integer not null check (passes > 0),
  used integer not null default 0,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  note text,
  check (used >= 0 and used <= passes),
  check (expires_at > granted_at),
  unique (member_id, source_key)
);
create index bonus_passes_usable_idx on public.bonus_passes (member_id, expires_at) where used < passes;

alter table public.orders add column bonus_pass_id uuid references public.bonus_passes (id);

-- Grand Tour: free months of the member's plan, given once (applied as a Stripe coupon).
create table public.grand_tour_rewards (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  free_months integer not null check (free_months > 0),
  stripe_coupon text,
  granted_at timestamptz not null default now()
);

-- Referrals: every member gets a code; a friend who signs up with it is linked to them. The
-- friend counts once their first month is paid (first_paid_at).
alter table public.profiles add column referral_code text unique;
alter table public.profiles add column referred_by uuid references public.profiles (id) on delete set null;
alter table public.profiles add column first_paid_at timestamptz;
alter table public.profiles add constraint profiles_no_self_referral check (referred_by is null or referred_by <> id);
create index profiles_referred_by_idx on public.profiles (referred_by) where referred_by is not null;

create or replace function public.make_referral_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := 'SB-';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from profiles where referral_code = code);
  end loop;
  return code;
end $$;

update public.profiles set referral_code = public.make_referral_code() where referral_code is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ref uuid;
begin
  select id into v_ref from profiles where referral_code = upper(trim(new.raw_user_meta_data ->> 'ref'));
  insert into public.profiles (id, email, name, role, referral_code, referred_by)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'shop_owner' then 'shop_owner'::public.user_role else 'member'::public.user_role end,
    public.make_referral_code(),
    case when v_ref is distinct from new.id then v_ref end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Shops count toward the Grand Tour once they've been live 30 days.
alter table public.shops add column live_since timestamptz;
update public.shops set live_since = created_at where status = 'active' and live_since is null;
create or replace function public.set_shop_live_since() returns trigger language plpgsql as $$
begin
  if new.status = 'active' and new.live_since is null then new.live_since = now(); end if;
  return new;
end $$;
create trigger shops_live_since before insert or update of status on public.shops
  for each row execute function public.set_shop_live_since();

-- Place an order: this period's pass first, then the bonus pass that expires soonest.
create or replace function public.place_order(
  p_member uuid,
  p_shop uuid,
  p_subscription uuid,
  p_period_start timestamptz,
  p_total integer,
  p_pass_covered integer,
  p_overage integer,
  p_max_pass_value integer,
  p_pass_day date,
  p_items jsonb,
  p_pickup timestamptz,
  p_overage_payment_intent text,
  p_overage_confirmed boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
  v_items_total integer;
  v_order uuid;
  v_bonus uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_member::text, 0));

  select coalesce(sum((i ->> 'quantity')::int * (i ->> 'unit_price')::int), 0) into v_items_total
    from jsonb_array_elements(p_items) i;
  if v_items_total <> p_total or p_total <= 0 or p_pass_covered + p_overage <> p_total then
    raise exception 'ORDER_TOTAL_MISMATCH' using errcode = 'P0001';
  end if;
  if p_pass_covered <> least(p_total, p_max_pass_value) then
    raise exception 'PASS_VALUE_MISMATCH' using errcode = 'P0001';
  end if;
  if p_overage > 0 and not coalesce(p_overage_confirmed, false) then
    raise exception 'OVERAGE_CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  if exists (select 1 from orders where member_id = p_member and pass_day = p_pass_day and status <> 'cancelled') then
    raise exception 'PASS_USED_TODAY' using errcode = 'P0001';
  end if;

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

  insert into orders (member_id, shop_id, subscription_id, period_start, total, pass_covered_amount, overage_amount, pass_day,
                      pickup_time, overage_confirmed_at, overage_payment_intent, overage_status, bonus_pass_id)
    values (p_member, p_shop, p_subscription, p_period_start, p_total, p_pass_covered, p_overage, p_pass_day,
            p_pickup, case when p_overage > 0 then now() end, p_overage_payment_intent,
            case when p_overage = 0 then 'none'::overage_status
                 when p_overage_payment_intent is null then 'waived'::overage_status
                 else 'authorized'::overage_status end,
            v_bonus)
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

  return v_order;
end $$;

-- Cancel: a period pass comes back if it's still the same period (p_refund); a bonus pass comes
-- back while it hasn't expired.
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
end $$;

alter table public.bonus_passes enable row level security;
alter table public.grand_tour_rewards enable row level security;
create policy bonus_own on public.bonus_passes for select using (member_id = auth.uid() or public.is_admin());
create policy grand_tour_own on public.grand_tour_rewards for select using (member_id = auth.uid() or public.is_admin());
