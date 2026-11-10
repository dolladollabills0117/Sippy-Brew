"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";

export function AdminShopActions({
  id,
  status,
  spotlight,
  removedForFood,
  founding,
}: {
  id: string;
  status: string;
  spotlight: boolean;
  removedForFood?: boolean;
  founding?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/shops/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" ? (
        <Button size="sm" disabled={busy} onClick={() => patch({ status: "active" })}>
          {status === "pending" ? "Approve" : removedForFood ? "Reinstate" : "Resume"}
        </Button>
      ) : (
        <Button size="sm" variant="danger" disabled={busy} onClick={() => patch({ status: "paused" })}>
          Pause
        </Button>
      )}
      {!removedForFood && (
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => window.confirm("Remove this shop for selling food? It's hidden from members right away and the owner is emailed with how to appeal.") && patch({ remove: "food" })}
        >
          Remove: selling food
        </Button>
      )}
      <Button size="sm" variant="secondary" disabled={busy} aria-pressed={founding} onClick={() => patch({ founding: !founding })}>
        {founding ? "Founding (12%)" : "Standard (15%)"}
      </Button>
      <Button size="sm" variant="secondary" disabled={busy} aria-pressed={spotlight} onClick={() => patch({ spotlight: !spotlight })}>
        {spotlight ? "★ Spotlighted" : "Spotlight"}
      </Button>
    </div>
  );
}
