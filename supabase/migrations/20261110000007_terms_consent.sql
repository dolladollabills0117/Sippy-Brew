-- Members agree to the Terms (and the pre-purchase summary: renewal, expiry, cancellation) before
-- paying. We record when and which version, for disputes and for re-consent when terms change.
alter table public.profiles add column terms_accepted_at timestamptz;
alter table public.profiles add column terms_version text;

-- Messages from the Contact page (members, shops, anyone). Also emailed to support.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  topic text not null check (topic in ('member', 'shop', 'other')),
  message text not null check (char_length(message) between 10 and 4000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.contact_messages enable row level security;
create policy contact_admin on public.contact_messages for select using (public.is_admin());
