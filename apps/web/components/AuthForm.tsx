"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Alert, Button, Field, inputClass } from "./ui";

/** Email + password, or a magic link. Used for both sign up and log in. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const isShop = params.get("role") === "shop";
  const plan = params.get("plan");
  const requested = params.get("next");
  const next =
    requested && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : isShop ? "/shop/onboarding" : plan ? `/plans?plan=${plan}` : "/home";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  // A friend's referral code (from /signup?ref=SB-XXXXXX) links this member to them.
  const ref = params.get("ref");
  const meta = { name: name.trim(), role: isShop ? "shop_owner" : "member", ...(ref && !isShop ? { ref: ref.trim().toUpperCase() } : {}) };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const res =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: callback() } })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) return setError(res.error.message);
    if (mode === "signup" && !res.data.session) return setSent(true); // email confirmation required
    router.push(next);
    router.refresh();
  }

  async function magicLink() {
    if (!email) return setError("Enter your email first.");
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback(), data: mode === "signup" ? meta : undefined, shouldCreateUser: mode === "signup" },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  if (sent) return <Alert tone="success">Check your email for a link to continue.</Alert>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      {mode === "signup" && (
        <Field id="name" label={isShop ? "Your name" : "First and last name"}>
          <input id="name" className={inputClass} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <Field id="email" label="Email">
        <input id="email" type="email" className={inputClass} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="password" label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <input
          id="password"
          type="password"
          className={inputClass}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={busy || !email || password.length < 8}>
        {mode === "signup" ? "Create account" : "Log in"}
      </Button>
      <div className="flex items-center gap-3 text-sm text-pecan">
        <span className="h-px flex-1 bg-latte" /> or <span className="h-px flex-1 bg-latte" />
      </div>
      <Button type="button" variant="secondary" onClick={magicLink} disabled={busy}>
        Email me a magic link
      </Button>
    </form>
  );
}
