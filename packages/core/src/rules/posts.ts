import { RULES } from "../config";
import { dayKey } from "../time";

export type PostCheck = { ok: true; postDay: string } | { ok: false; code: "POST_LIMIT" | "POST_INVALID"; message: string };

/** Shops can post one daily special or announcement per calendar day. */
export function checkCanPost(
  body: string,
  existingPostDays: readonly string[],
  now: Date,
  timeZone: string = RULES.timeZone,
): PostCheck {
  const text = body.trim();
  if (text.length < 3) return { ok: false, code: "POST_INVALID", message: "Write a little more." };
  if (text.length > RULES.postMaxChars)
    return { ok: false, code: "POST_INVALID", message: `Keep it under ${RULES.postMaxChars} characters.` };
  const today = dayKey(now, timeZone);
  const usedToday = existingPostDays.filter((d) => d === today).length;
  if (usedToday >= RULES.postsPerShopPerDay)
    return { ok: false, code: "POST_LIMIT", message: "You've already posted today. Come back tomorrow." };
  return { ok: true, postDay: today };
}

export function validateStory(story: string): string | null {
  if (story.trim().length === 0) return "Tell members a little about your shop.";
  if (story.length > RULES.shopStoryMaxChars) return `Keep your story to ${RULES.shopStoryMaxChars} characters.`;
  return null;
}
