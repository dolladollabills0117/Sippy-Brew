import "server-only";
import { formatCents, type Order } from "@sippy/core";
import { env } from "./env";
import { supabaseAdmin } from "./supabase/server";

// ---------------- Email ----------------
// Uses Resend's HTTP API when RESEND_API_KEY is set; otherwise logs to the server console.

export async function sendEmail(to: string, subject: string, text: string) {
  if (!to) return;
  const key = env.resendKey();
  if (!key) {
    console.info(`[email] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom(), to, subject, text }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text());
}

// ---------------- Push (Expo) ----------------

export async function sendPush(userIds: string[], app: "consumer" | "shop", title: string, body: string, data: Record<string, unknown> = {}) {
  if (!userIds.length) return;
  const { data: tokens } = await supabaseAdmin().from("push_tokens").select("token").in("user_id", userIds).eq("app", app);
  const messages = (tokens ?? []).map((t) => ({ to: t.token, title, body, data, sound: "default" }));
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (!res.ok) console.error("[push] send failed", res.status);
  }
}

async function emailOf(userId: string): Promise<string> {
  const { data } = await supabaseAdmin().from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? "";
}

// ---------------- Events ----------------

/** Sends the sign-up email once per account (called after the first sign-in). */
export async function maybeSendWelcome(userId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("profiles").update({ welcomed_at: new Date().toISOString() }).eq("id", userId).is("welcomed_at", null).select("email, name, role");
  const p = data?.[0];
  if (!p) return;
  if (p.role === "shop_owner") {
    await sendEmail(p.email, "Welcome to Sippy Brew for shops", `Hi ${p.name || "there"},\n\nFinish setting up your shop, connect Stripe for payouts, and add your coffee menu. We'll email you as soon as you're approved.\n\n${env.siteUrl()}/shop/onboarding`);
  } else {
    await sendEmail(p.email, "Welcome to Sippy Brew ☕", `Hi ${p.name || "there"},\n\nYou're in. Pick a plan, find a shop near you, and order your first coffee for pickup.\n\n${env.siteUrl()}/plans`);
  }
}

export async function notifyMemberRenewal(memberId: string, tierName: string, creditCents: number) {
  await sendEmail(
    await emailOf(memberId),
    "Your Sippy Brew credit just reset",
    `Your ${tierName} plan renewed. You have ${formatCents(creditCents)} in coffee credit this month. Unused credit from last month has expired.\n\n${env.siteUrl()}/shops`,
  );
  await sendPush([memberId], "consumer", "Fresh credit ☕", `${formatCents(creditCents)} is ready to spend this month.`, { screen: "shops" });
}

export async function notifyMemberRenewalReminder(memberId: string, tierName: string, renewsOn: string) {
  await sendPush([memberId], "consumer", "Renewing soon", `Your ${tierName} plan renews on ${renewsOn}. Unused credit doesn't roll over.`, { screen: "account" });
}

export async function notifyShopNewOrder(order: Order) {
  const { data: shop } = await supabaseAdmin().from("shops").select("owner_id").eq("id", order.shopId).maybeSingle();
  if (!shop) return;
  const items = order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
  await Promise.all([
    sendPush([shop.owner_id], "shop", `New order from ${order.memberFirstName}`, items, { orderId: order.id }),
    sendEmail(await emailOf(shop.owner_id), `New pickup order: ${order.memberFirstName}`, `${items}\nPickup at ${new Date(order.pickupTime).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })}`),
  ]);
}

export async function notifyMemberOrderStatus(order: Order) {
  const text: Partial<Record<Order["status"], string>> = {
    preparing: `${order.shopName} is making your order.`,
    ready: `Your order is ready at ${order.shopName}. Show your QR at the counter.`,
    cancelled: `${order.shopName} cancelled your order. Your credit was returned.`,
  };
  const body = text[order.status];
  if (body) await sendPush([order.memberId], "consumer", "Order update", body, { orderId: order.id });
}

export async function notifyFollowersOfPost(shopId: string, shopName: string, body: string) {
  const { data } = await supabaseAdmin().from("saved_shops").select("member_id, profiles:member_id(email)").eq("shop_id", shopId);
  const rows = (data ?? []) as unknown as { member_id: string; profiles: { email: string } | null }[];
  await sendPush(rows.map((r) => r.member_id), "consumer", `${shopName} posted a special`, body, { shopId });
  for (const r of rows) if (r.profiles?.email) await sendEmail(r.profiles.email, `Today at ${shopName}`, `${body}\n\n${env.siteUrl()}/shops/${shopId}`);
}

export async function notifyShopPayout(shopId: string, netCents: number, periodLabel: string) {
  const { data: shop } = await supabaseAdmin().from("shops").select("owner_id").eq("id", shopId).maybeSingle();
  if (!shop) return;
  await sendEmail(await emailOf(shop.owner_id), `Payout sent: ${formatCents(netCents)}`, `Your Sippy Brew payout for ${periodLabel} is on its way to your bank.\n\n${env.siteUrl()}/shop/payouts`);
  await sendPush([shop.owner_id], "shop", "Payout sent", `${formatCents(netCents)} for ${periodLabel}`, { screen: "dashboard" });
}

export async function notifyShopStatus(shopId: string, status: string) {
  const { data: shop } = await supabaseAdmin().from("shops").select("owner_id, name").eq("id", shopId).maybeSingle();
  if (!shop) return;
  const msg = status === "active" ? `${shop.name} is approved and live on Sippy Brew. Members can now order from you.` : `${shop.name} is paused and hidden from members. Reply to this email with any questions.`;
  await sendEmail(await emailOf(shop.owner_id), status === "active" ? "You're live on Sippy Brew" : "Your shop is paused", msg);
}
