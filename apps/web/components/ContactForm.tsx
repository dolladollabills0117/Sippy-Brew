"use client";
import { SITE } from "@sippy/core";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, inputClass } from "./ui";

/** Message support. Also shows the email address for anyone who'd rather write directly. */
export function ContactForm({ defaultTopic = "member", defaultEmail = "", defaultName = "" }: { defaultTopic?: "member" | "shop" | "other"; defaultEmail?: string; defaultName?: string }) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [topic, setTopic] = useState(defaultTopic);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.contact({ name, email, topic, message, ...(website ? { website } : {}) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Couldn't send. Email us at ${SITE.supportEmail} instead.`);
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <Alert tone="success">Thanks! We got your message and will reply to {email} soon.</Alert>;
  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <Field label="Your name" id="c-name">
        <input id="c-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
      </Field>
      <Field label="Email we can reply to" id="c-email">
        <input id="c-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="email" />
      </Field>
      <Field label="I'm a…" id="c-topic">
        <select id="c-topic" className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value as typeof topic)}>
          <option value="member">Member (coffee drinker)</option>
          <option value="shop">Coffee shop</option>
          <option value="other">Something else</option>
        </select>
      </Field>
      <Field label="Message" id="c-message">
        <textarea id="c-message" rows={5} className={`${inputClass} py-3`} value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={4000} />
      </Field>
      {/* Spam trap: hidden from people, filled in by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={busy} className="self-start">
        {busy ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
