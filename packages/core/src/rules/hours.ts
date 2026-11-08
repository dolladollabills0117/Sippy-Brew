import { RULES } from "../config";
import { WEEKDAYS, zonedParts, type Weekday } from "../time";

/** Opening hours by weekday, "HH:MM" 24h local time. null = closed that day. */
export type ShopHours = Partial<Record<Weekday, { open: string; close: string } | null>>;

function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`bad time: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function validateHours(hours: ShopHours): string | null {
  for (const day of WEEKDAYS) {
    const h = hours[day];
    if (!h) continue;
    try {
      if (toMinutes(h.open) >= toMinutes(h.close)) return `${day}: closing time must be after opening time`;
    } catch {
      return `${day}: use HH:MM times`;
    }
  }
  return null;
}

export function isOpenAt(hours: ShopHours, at: Date, timeZone: string = RULES.timeZone): boolean {
  const p = zonedParts(at, timeZone);
  const h = hours[p.weekday];
  if (!h) return false;
  const mins = p.hour * 60 + p.minute;
  return mins >= toMinutes(h.open) && mins < toMinutes(h.close);
}

export function formatHours(h: { open: string; close: string } | null | undefined): string {
  if (!h) return "Closed";
  const fmt = (t: string) => {
    const mins = toMinutes(t);
    const hr = Math.floor(mins / 60);
    const mm = mins % 60;
    const suffix = hr >= 12 ? "pm" : "am";
    const h12 = hr % 12 === 0 ? 12 : hr % 12;
    return mm ? `${h12}:${String(mm).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
  };
  return `${fmt(h.open)}–${fmt(h.close)}`;
}

export type PickupCheck = { ok: true } | { ok: false; code: "INVALID_PICKUP"; message: string };

/** Pickup must be 5–120 minutes from now and while the shop is open. */
export function checkPickupTime(
  pickupAt: Date,
  now: Date,
  hours: ShopHours,
  timeZone: string = RULES.timeZone,
  rules: Pick<typeof RULES, "minPickupLeadMinutes" | "maxPickupLeadMinutes"> = RULES,
): PickupCheck {
  const lead = (pickupAt.getTime() - now.getTime()) / 60_000;
  // One minute of grace for clock drift between phone and server.
  if (lead < rules.minPickupLeadMinutes - 1)
    return { ok: false, code: "INVALID_PICKUP", message: `Pick a time at least ${rules.minPickupLeadMinutes} minutes from now.` };
  if (lead > rules.maxPickupLeadMinutes)
    return { ok: false, code: "INVALID_PICKUP", message: `Pickup must be within ${rules.maxPickupLeadMinutes / 60} hours.` };
  if (!isOpenAt(hours, pickupAt, timeZone)) return { ok: false, code: "INVALID_PICKUP", message: "The shop is closed at that time." };
  return { ok: true };
}

/** Pickup slots every 5 minutes inside the allowed window while the shop is open. */
export function pickupSlots(now: Date, hours: ShopHours, timeZone: string = RULES.timeZone, rules = RULES): Date[] {
  const step = 5 * 60_000;
  const first = Math.ceil((now.getTime() + rules.minPickupLeadMinutes * 60_000) / step) * step;
  const last = now.getTime() + rules.maxPickupLeadMinutes * 60_000;
  const out: Date[] = [];
  for (let t = first; t <= last; t += step) {
    const d = new Date(t);
    if (isOpenAt(hours, d, timeZone)) out.push(d);
  }
  return out;
}
