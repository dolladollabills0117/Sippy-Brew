/**
 * Calendar-day helpers. "Today" for the daily limit and the one-post-per-day rule means the
 * local calendar day in the platform time zone (config/rules.json -> timeZone), not UTC.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export const WEEKDAYS: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: (out.weekday ?? "Sun").slice(0, 3).toLowerCase() as Weekday,
  };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds (e.g. -4h for EDT). */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of a local wall-clock time in `timeZone`. Handles DST. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall - tzOffsetMs(new Date(wall), timeZone);
  guess = wall - tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

function addDaysUtc(year: number, month: number, day: number, delta: number): [number, number, number] {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/** "YYYY-MM-DD" of the local calendar day. */
export function dayKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export interface Range {
  start: Date;
  end: Date;
}

/** [start, end) UTC instants of the local calendar day containing `date`. */
export function dayBounds(date: Date, timeZone: string): Range {
  const p = zonedParts(date, timeZone);
  const [y, m, d] = addDaysUtc(p.year, p.month, p.day, 1);
  return {
    start: zonedTimeToUtc(p.year, p.month, p.day, 0, 0, timeZone),
    end: zonedTimeToUtc(y, m, d, 0, 0, timeZone),
  };
}

/** [start, end) of the local Monday-to-Monday week containing `date`. */
export function weekBounds(date: Date, timeZone: string): Range {
  const p = zonedParts(date, timeZone);
  const sinceMonday = (WEEKDAYS.indexOf(p.weekday) + 6) % 7;
  const [y1, m1, d1] = addDaysUtc(p.year, p.month, p.day, -sinceMonday);
  const [y2, m2, d2] = addDaysUtc(p.year, p.month, p.day, 7 - sinceMonday);
  return { start: zonedTimeToUtc(y1, m1, d1, 0, 0, timeZone), end: zonedTimeToUtc(y2, m2, d2, 0, 0, timeZone) };
}

/** [start, end) of the local calendar month containing `date`. */
export function monthBounds(date: Date, timeZone: string): Range {
  const p = zonedParts(date, timeZone);
  const ny = p.month === 12 ? p.year + 1 : p.year;
  const nm = p.month === 12 ? 1 : p.month + 1;
  return { start: zonedTimeToUtc(p.year, p.month, 1, 0, 0, timeZone), end: zonedTimeToUtc(ny, nm, 1, 0, 0, timeZone) };
}

/** The most recent fully completed Monday-to-Monday week before `date` (the weekly payout period). */
export function previousWeekBounds(date: Date, timeZone: string): Range {
  const current = weekBounds(date, timeZone);
  return weekBounds(new Date(current.start.getTime() - 12 * 3600_000), timeZone);
}

export function isWithin(date: Date, range: Range): boolean {
  const t = date.getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}
