import { NextResponse } from "next/server";
import { maybeSendWelcome } from "@/lib/notify";
import { supabaseFromCookies } from "@/lib/supabase/server";

/** Magic-link and email-confirmation landing. Exchanges the code for a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/home";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  if (code) {
    const supabase = await supabaseFromCookies();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) await maybeSendWelcome(data.user.id).catch(() => {});
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
