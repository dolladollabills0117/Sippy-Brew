import "server-only";
import type { Profile } from "@sippy/core";
import { redirect } from "next/navigation";
import { forbidden, unauthorized } from "./http";
import { supabaseAdmin, supabaseFromCookies } from "./supabase/server";
import { mapProfile } from "./db";

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
}

async function profileFor(userId: string): Promise<Profile | null> {
  const { data } = await supabaseAdmin().from("profiles").select("*").eq("id", userId).maybeSingle();
  return data ? mapProfile(data) : null;
}

/**
 * Who is calling? Mobile apps send `Authorization: Bearer <supabase access token>`;
 * the web app sends its session cookie.
 */
export async function getSession(req?: Request): Promise<Session | null> {
  const header = req?.headers.get("authorization");
  let user: { id: string; email?: string } | null = null;
  if (header?.toLowerCase().startsWith("bearer ")) {
    const { data } = await supabaseAdmin().auth.getUser(header.slice(7).trim());
    user = data.user;
  } else {
    const { data } = await (await supabaseFromCookies()).auth.getUser();
    user = data.user;
  }
  if (!user) return null;
  const profile = await profileFor(user.id);
  if (!profile) return null;
  return { userId: user.id, email: user.email ?? profile.email, profile };
}

/** For API routes. */
export async function requireApiSession(req: Request, role?: Profile["role"] | Profile["role"][]): Promise<Session> {
  const s = await getSession(req);
  if (!s) throw unauthorized();
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(s.profile.role) && s.profile.role !== "admin") throw forbidden();
  }
  return s;
}

/** For pages: redirect to login (or home) instead of throwing. */
export async function requirePageSession(role?: Profile["role"], next = "/home"): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (role && s.profile.role !== role && s.profile.role !== "admin") redirect(s.profile.role === "shop_owner" ? "/shop" : "/home");
  return s;
}
