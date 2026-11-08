import { env } from "@/lib/env";
import { runWeeklyPayouts } from "@/lib/payouts";

export const runtime = "nodejs";

/** Run weekly (e.g. Mondays 10:00 ET) from Vercel Cron or any scheduler with the CRON_SECRET. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runWeeklyPayouts());
}
