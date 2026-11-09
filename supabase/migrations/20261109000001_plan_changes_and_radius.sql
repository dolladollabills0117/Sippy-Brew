-- Plan changes take effect at the next renewal. The member keeps this period's plan (tier) and
-- the switch waits in pending_tier until the next period starts (apps/web/lib/billing.ts).
alter table public.subscriptions add column if not exists pending_tier public.tier_id;

-- Keep it local: saved search areas are capped at a 15-mile radius (RULES.maxRadiusMiles).
update public.member_areas set radius_miles = 15 where radius_miles > 15;
alter table public.member_areas drop constraint if exists member_areas_radius_miles_check;
alter table public.member_areas add constraint member_areas_radius_miles_check check (radius_miles > 0 and radius_miles <= 15);
