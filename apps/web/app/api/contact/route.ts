import { getSession } from "@/lib/auth";
import { badRequest, json, readJson, route } from "@/lib/http";
import { sendToSupport } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase/server";

const TOPICS = ["member", "shop", "other"] as const;

/** Contact page: members, shops or anyone. Stored, and emailed to support. */
export const POST = route(async (req: Request) => {
  const s = await getSession(req).catch(() => null);
  const b = await readJson<{ name?: string; email?: string; topic?: string; message?: string; website?: string }>(req);
  if (b.website) return json({ sent: true }); // spam trap: humans never fill this hidden field
  const name = String(b.name ?? "").trim().slice(0, 100);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const message = String(b.message ?? "").trim();
  const topic = TOPICS.includes(b.topic as (typeof TOPICS)[number]) ? (b.topic as (typeof TOPICS)[number]) : "other";
  if (!name) throw badRequest("BAD_NAME", "Add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("BAD_EMAIL", "Add an email we can reply to.");
  if (message.length < 10 || message.length > 4000) throw badRequest("BAD_MESSAGE", "Write a message between 10 and 4,000 characters.");
  await supabaseAdmin().from("contact_messages").insert({ user_id: s?.userId ?? null, name, email, topic, message });
  await sendToSupport({ name, email, topic, userId: s?.userId ?? null }, message);
  return json({ sent: true });
});
