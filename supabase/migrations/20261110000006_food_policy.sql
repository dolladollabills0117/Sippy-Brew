-- No food, whatsoever. A shop caught selling food is removed (paused with removal_reason
-- 'food'). It can appeal once if the listing was a genuine error, not misrepresentation; an
-- admin reviews the appeal and reinstates the shop (status back to active) or not.
alter table public.shops add column food_policy_accepted_at timestamptz;
alter table public.shops add column removal_reason text check (removal_reason is null or removal_reason in ('food'));
alter table public.shops add column removed_at timestamptz;
alter table public.shops add column appeal_note text check (appeal_note is null or char_length(appeal_note) <= 1000);
alter table public.shops add column appealed_at timestamptz;
-- A removed shop can't simply be switched back on by its owner.
alter table public.shops add constraint shops_removed_is_paused check (removal_reason is null or status = 'paused');
