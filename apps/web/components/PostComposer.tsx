"use client";
import { dayKey, RULES, type Post } from "@sippy/core";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card, EmptyState, Field, inputClass } from "./ui";

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: RULES.timeZone });

export function PostComposer({ initial, canPost }: { initial: Post[]; canPost: boolean }) {
  const [posts, setPosts] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = dayKey(new Date(), RULES.timeZone);
  const postedToday = posts.some((p) => dayKey(new Date(p.createdAt), RULES.timeZone) === today);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { post } = await api.shopPost(body);
      setPosts((l) => [post, ...l]);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        {postedToday ? (
          <Alert tone="success">You&apos;ve posted today. You can post again tomorrow.</Alert>
        ) : !canPost ? (
          <Alert>You can post once your shop is approved.</Alert>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            {error && <Alert tone="error">{error}</Alert>}
            <Field id="post" label="Today's special or announcement" hint={`${body.length}/${RULES.postMaxChars} characters · one post per day`}>
              <textarea id="post" rows={4} maxLength={RULES.postMaxChars} className={inputClass} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy || body.trim().length < 3}>
              Post to members
            </Button>
          </form>
        )}
      </Card>
      <div>
        {posts.length === 0 ? (
          <EmptyState title="No posts yet" />
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((p) => (
              <li key={p.id} className="card p-4">
                <p className="text-sm font-bold text-pecan">{fmt.format(new Date(p.createdAt))}</p>
                <p className="text-espresso">{p.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
