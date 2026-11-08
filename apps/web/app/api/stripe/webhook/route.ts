import { stripe, syncSubscription } from "@/lib/billing";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig ?? "", env.stripeWebhookSecret());
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  const db = supabaseAdmin();
  const { error: dupe } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupe?.code === "23505") return new Response("duplicate", { status: 200 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe().subscriptions.retrieve(String(session.subscription));
          await syncSubscription(sub, { grant: true });
        }
        break;
      }
      case "invoice.paid": {
        // Renewal: Stripe has moved the period forward. Expire unused passes, grant fresh ones.
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null; parent?: { subscription_details?: { subscription?: string } } };
        const subId = invoice.parent?.subscription_details?.subscription ?? invoice.subscription;
        if (subId) await syncSubscription(await stripe().subscriptions.retrieve(String(subId)), { grant: true });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const { data: profile } = await db.from("profiles").select("id").eq("stripe_customer_id", String(invoice.customer)).maybeSingle();
        await db.from("payment_failures").upsert(
          { member_id: profile?.id ?? null, stripe_invoice_id: invoice.id, amount: invoice.amount_due, reason: invoice.last_finalization_error?.message ?? "Payment failed" },
          { onConflict: "stripe_invoice_id" },
        );
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription, { grant: false });
        break;
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await db.from("shops").update({ payouts_enabled: Boolean(account.payouts_enabled) }).eq("stripe_account_id", account.id);
        break;
      }
    }
  } catch (e) {
    console.error("webhook handling failed", event.type, e);
    await db.from("stripe_events").delete().eq("id", event.id); // let Stripe retry
    return new Response("handler error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}
