import { requireApiSession } from "@/lib/auth";
import { stripe } from "@/lib/billing";
import { env } from "@/lib/env";
import { json, route } from "@/lib/http";
import { getOwnerShopRow } from "@/lib/shop";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Stripe Connect Express onboarding so the shop can receive weekly payouts. */
export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "shop_owner");
  const shop = await getOwnerShopRow(s);
  let accountId: string | null = shop.stripe_account_id;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      country: "US",
      email: s.email,
      business_profile: { name: shop.name, mcc: "5814" },
      capabilities: { transfers: { requested: true } },
      metadata: { shop_id: shop.id },
    });
    accountId = account.id;
    await supabaseAdmin().from("shops").update({ stripe_account_id: accountId }).eq("id", shop.id);
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.siteUrl()}/shop/onboarding?stripe=refresh`,
    return_url: `${env.siteUrl()}/shop/onboarding?stripe=done`,
  });
  return json({ url: link.url });
});
