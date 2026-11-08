-- Sippy Brew schema.
-- Money is integer cents everywhere. Business rules live in packages/core; the functions at the
-- bottom of this file re-check one-pass-per-day, the monthly pass allowance and QR single-use
-- atomically so two requests racing each other can't get around them.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('member', 'shop_owner', 'admin');
create type public.tier_id as enum ('casual', 'routine', 'daily_ritual');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid');
create type public.pass_ledger_type as enum ('grant', 'use', 'release', 'expire');
create type public.upgrade_status as enum ('none', 'authorized', 'captured', 'voided', 'failed');
create type public.shop_status as enum ('pending', 'active', 'paused');
create type public.coffee_category as enum ('espresso', 'brewed', 'cold', 'specialty');
create type public.order_status as enum ('received', 'preparing', 'ready', 'picked_up', 'cancelled');
create type public.payout_status as enum ('pending', 'paid', 'failed');
create type public.area_kind as enum ('home', 'work');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  role public.user_role not null default 'member',
  stripe_customer_id text unique,
  welcomed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  tier public.tier_id not null,
  status public.subscription_status not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  -- Snapshot of the tier's allowance for the current period, set when the period's passes are
  -- granted, so editing config/tiers.json mid-period doesn't change a member's current month.
  period_passes integer,
  period_max_pass_value integer,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);
create index subscriptions_member_idx on public.subscriptions (member_id, created_at desc);
-- One live subscription per member.
create unique index subscriptions_one_live_idx on public.subscriptions (member_id)
  where status in ('active', 'trialing', 'past_due', 'incomplete');

-- Daily Pass ledger, in passes. grant/release > 0, use/expire < 0. period_start ties every
-- entry to the subscription period it belongs to; the balance is the sum for the current
-- period only, so unused passes can never roll over.
create table public.pass_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  period_start timestamptz not null,
  passes integer not null,
  type public.pass_ledger_type not null,
  order_id uuid,
  note text,
  created_at timestamptz not null default now(),
  check ((type in ('grant', 'release') and passes > 0) or (type in ('use', 'expire') and passes < 0))
);
create index pass_ledger_member_period_idx on public.pass_ledger (member_id, period_start);
-- Webhook retries must not double-grant or double-expire a period.
create unique index pass_ledger_one_grant_idx on public.pass_ledger (subscription_id, period_start) where type = 'grant';
create unique index pass_ledger_one_expire_idx on public.pass_ledger (subscription_id, period_start) where type = 'expire';
create unique index pass_ledger_one_use_idx on public.pass_ledger (order_id) where type = 'use';
create unique index pass_ledger_one_release_idx on public.pass_ledger (order_id) where type = 'release';

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  hours jsonb not null default '{}'::jsonb,
  story text not null default '' check (char_length(story) <= 300),
  photo_url text,
  status public.shop_status not null default 'pending',
  spotlight boolean not null default false,
  stripe_account_id text unique,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index shops_one_per_owner_idx on public.shops (owner_id);

-- Coffee items only: the category enum has no food values.
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  size text not null,
  price integer not null check (price between 100 and 2000),
  category public.coffee_category not null,
  available boolean not null default true,
  -- "Sold out today": the local date it was marked sold out. It clears itself the next day.
  sold_out_on date,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index menu_items_shop_idx on public.menu_items (shop_id) where not archived;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  subscription_id uuid not null references public.subscriptions (id),
  period_start timestamptz not null,
  status public.order_status not null default 'received',
  -- total = full value at menu prices = pass_value (covered by the Daily Pass) + upgrade
  -- (paid by the member). Commission is 12% of total.
  total integer not null check (total > 0),
  pass_value integer not null check (pass_value >= 0),
  upgrade integer not null default 0 check (upgrade >= 0),
  pass_day date not null,
  upgrade_payment_intent text,
  upgrade_status public.upgrade_status not null default 'none',
  -- Locked in at redemption with the commission rate in force (packages/core splitOrder).
  commission integer,
  net integer,
  pickup_time timestamptz not null,
  redeemed_at timestamptz,
  payout_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((commission is null and net is null) or (commission + net = total)),
  check (pass_value + upgrade = total)
);
create index orders_member_created_idx on public.orders (member_id, created_at desc);
create index orders_shop_created_idx on public.orders (shop_id, created_at desc);
-- One Daily Pass per member per calendar day, across all shops.
create unique index orders_one_pass_per_day_idx on public.orders (member_id, pass_day) where status <> 'cancelled';
create index orders_unpaid_idx on public.orders (shop_id, redeemed_at) where status = 'picked_up' and payout_id is null;

alter table public.pass_ledger
  add constraint pass_ledger_order_fk foreign key (order_id) references public.orders (id) on delete set null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id),
  name text not null,
  size text not null,
  quantity integer not null check (quantity between 1 and 4),
  unit_price integer not null check (unit_price > 0)
);
create index order_items_order_idx on public.order_items (order_id);

-- One row per QR issued. The member's screen refreshes every ~25s, and each refresh expires
-- the previous code. Only one redemption per order is ever allowed.
create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  qr_token text not null unique,
  short_code text not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index redemptions_short_code_idx on public.redemptions (short_code, expires_at);
create unique index redemptions_one_per_order_idx on public.redemptions (order_id) where redeemed_at is not null;

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  gross integer not null check (gross >= 0),
  commission integer not null check (commission >= 0),
  net integer not null check (net >= 0),
  order_count integer not null default 0,
  status public.payout_status not null default 'pending',
  stripe_transfer_id text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, period_start),
  check (gross = commission + net)
);

alter table public.orders
  add constraint orders_payout_fk foreign key (payout_id) references public.payouts (id) on delete set null;

-- Message board: one post per shop per local calendar day.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 280),
  post_day date not null,
  created_at timestamptz not null default now(),
  unique (shop_id, post_day)
);
create index posts_created_idx on public.posts (created_at desc);

create table public.saved_shops (
  member_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, shop_id)
);

create table public.member_areas (
  member_id uuid not null references public.profiles (id) on delete cascade,
  kind public.area_kind not null,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  radius_miles real not null default 2 check (radius_miles > 0 and radius_miles <= 25),
  primary key (member_id, kind)
);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  app text not null check (app in ('consumer', 'shop')),
  platform text not null,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- Stripe webhook idempotency and failed-payment log for the admin view.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

create table public.payment_failures (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles (id) on delete set null,
  stripe_invoice_id text unique,
  amount integer not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- New users get a profile. Role comes from sign-up metadata but can never be admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'shop_owner' then 'shop_owner'::public.user_role else 'member'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic writes (called by apps/web with the service role only)
-- ---------------------------------------------------------------------------

-- Place a pass order. The API validates with packages/core first (for friendly messages), then
-- this function re-checks one pass per day and the pass balance under a per-member lock and
-- writes the order, items and the pass use in one transaction.
create or replace function public.place_order(
  p_member uuid,
  p_shop uuid,
  p_subscription uuid,
  p_period_start timestamptz,
  p_total integer,
  p_pass_value integer,
  p_upgrade integer,
  p_max_pass_value integer,
  p_pass_day date,          -- local calendar day from packages/core dayKey()
  p_items jsonb,            -- [{menu_item_id, name, size, quantity, unit_price}]
  p_pickup timestamptz,
  p_upgrade_payment_intent text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
  v_items_total integer;
  v_order uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_member::text, 0));

  select coalesce(sum((i ->> 'quantity')::int * (i ->> 'unit_price')::int), 0) into v_items_total
    from jsonb_array_elements(p_items) i;
  if v_items_total <> p_total or p_total <= 0 or p_pass_value + p_upgrade <> p_total then
    raise exception 'ORDER_TOTAL_MISMATCH' using errcode = 'P0001';
  end if;
  if p_pass_value <> least(p_total, p_max_pass_value) then
    raise exception 'PASS_VALUE_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (select 1 from orders where member_id = p_member and pass_day = p_pass_day and status <> 'cancelled') then
    raise exception 'PASS_USED_TODAY' using errcode = 'P0001';
  end if;

  select coalesce(sum(passes), 0) into v_balance from pass_ledger
    where member_id = p_member and subscription_id = p_subscription and period_start = p_period_start;
  if v_balance < 1 then
    raise exception 'NO_PASSES_LEFT' using errcode = 'P0001';
  end if;

  insert into orders (member_id, shop_id, subscription_id, period_start, total, pass_value, upgrade, pass_day, pickup_time,
                      upgrade_payment_intent, upgrade_status)
    values (p_member, p_shop, p_subscription, p_period_start, p_total, p_pass_value, p_upgrade, p_pass_day, p_pickup,
            p_upgrade_payment_intent, case when p_upgrade > 0 then 'authorized'::upgrade_status else 'none'::upgrade_status end)
    returning id into v_order;

  insert into order_items (order_id, menu_item_id, name, size, quantity, unit_price)
    select v_order, (i ->> 'menu_item_id')::uuid, i ->> 'name', i ->> 'size', (i ->> 'quantity')::int, (i ->> 'unit_price')::int
    from jsonb_array_elements(p_items) i;

  insert into pass_ledger (member_id, subscription_id, period_start, passes, type, order_id, note)
    values (p_member, p_subscription, p_period_start, -1, 'use', v_order, 'Daily Pass');

  return v_order;
end $$;

-- Redeem a QR token exactly once. Returns the order id, or raises EXPIRED / ALREADY_REDEEMED /
-- WRONG_SHOP / ORDER_CANCELLED / NOT_FOUND. The row lock makes a double scan safe.
create or replace function public.redeem_qr(
  p_redemption uuid,
  p_shop uuid,
  p_staff uuid,
  p_commission integer,
  p_net integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r redemptions%rowtype;
  o orders%rowtype;
begin
  select * into r from redemptions where id = p_redemption for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into o from orders where id = r.order_id for update;

  if r.redeemed_at is not null or o.status = 'picked_up' then raise exception 'ALREADY_REDEEMED' using errcode = 'P0001'; end if;
  if o.status = 'cancelled' then raise exception 'ORDER_CANCELLED' using errcode = 'P0001'; end if;
  if o.shop_id <> p_shop then raise exception 'WRONG_SHOP' using errcode = 'P0001'; end if;
  if r.expires_at <= now() then raise exception 'EXPIRED' using errcode = 'P0001'; end if;
  if p_commission + p_net <> o.total then raise exception 'SPLIT_MISMATCH' using errcode = 'P0001'; end if;

  update redemptions set redeemed_at = now(), redeemed_by = p_staff where id = r.id;
  update orders set status = 'picked_up', redeemed_at = now(), commission = p_commission, net = p_net where id = o.id;
  return o.id;
end $$;

-- Cancel an order and give its pass back if it's still in the current period.
create or replace function public.cancel_order(p_order uuid, p_refund boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if o.status in ('picked_up', 'cancelled') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  update orders set status = 'cancelled' where id = o.id;
  update redemptions set expires_at = least(expires_at, now()) where order_id = o.id and redeemed_at is null;
  if p_refund then
    insert into pass_ledger (member_id, subscription_id, period_start, passes, type, order_id, note)
      values (o.member_id, o.subscription_id, o.period_start, 1, 'release', o.id, 'Order cancelled')
      on conflict do nothing;
  end if;
end $$;

-- Record a weekly payout and attach its orders in one step.
create or replace function public.create_payout(
  p_shop uuid, p_start timestamptz, p_end timestamptz, p_order_ids uuid[],
  p_gross integer, p_commission integer, p_net integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sum integer;
begin
  select coalesce(sum(total), 0) into v_sum from orders
    where id = any (p_order_ids) and shop_id = p_shop and status = 'picked_up' and payout_id is null;
  if v_sum <> p_gross then raise exception 'PAYOUT_MISMATCH' using errcode = 'P0001'; end if;
  insert into payouts (shop_id, period_start, period_end, gross, commission, net, order_count)
    values (p_shop, p_start, p_end, p_gross, p_commission, p_net, coalesce(array_length(p_order_ids, 1), 0))
    returning id into v_id;
  update orders set payout_id = v_id where id = any (p_order_ids);
  return v_id;
end $$;

revoke execute on function public.place_order(uuid, uuid, uuid, timestamptz, integer, integer, integer, integer, date, jsonb, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.redeem_qr(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.create_payout(uuid, timestamptz, timestamptz, uuid[], integer, integer, integer) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, uuid, timestamptz, integer, integer, integer, integer, date, jsonb, timestamptz, text) to service_role;
grant execute on function public.redeem_qr(uuid, uuid, uuid, integer, integer) to service_role;
grant execute on function public.cancel_order(uuid, boolean) to service_role;
grant execute on function public.create_payout(uuid, timestamptz, timestamptz, uuid[], integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security. The API uses the service role for writes; these policies are defense
-- in depth for any direct reads with a user's token.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.pass_ledger enable row level security;
alter table public.shops enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.redemptions enable row level security;
alter table public.payouts enable row level security;
alter table public.posts enable row level security;
alter table public.saved_shops enable row level security;
alter table public.member_areas enable row level security;
alter table public.push_tokens enable row level security;
alter table public.stripe_events enable row level security;
alter table public.payment_failures enable row level security;

create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Users may change their name but never their role.
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

create policy subscriptions_own on public.subscriptions for select using (member_id = auth.uid() or public.is_admin());
create policy ledger_own on public.pass_ledger for select using (member_id = auth.uid() or public.is_admin());

create policy shops_public on public.shops for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());
create policy menu_public on public.menu_items for select using (
  exists (select 1 from shops s where s.id = shop_id and (s.status = 'active' or s.owner_id = auth.uid()))
);

create policy orders_member on public.orders for select using (
  member_id = auth.uid() or public.is_admin()
  or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid())
);
create policy order_items_visible on public.order_items for select using (
  exists (select 1 from orders o where o.id = order_id)
);

create policy payouts_owner on public.payouts for select using (
  public.is_admin() or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid())
);
create policy posts_public on public.posts for select using (true);
create policy saved_own on public.saved_shops for all using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy areas_own on public.member_areas for all using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy push_own on public.push_tokens for select using (user_id = auth.uid());
create policy failures_admin on public.payment_failures for select using (public.is_admin());
-- redemptions and stripe_events: no policies, service role only.
