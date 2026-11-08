"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui";

export function SaveShopButton({ shopId, initial }: { shopId: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      aria-pressed={saved}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          setSaved((await api.setSaved(shopId, !saved)).saved);
        } finally {
          setBusy(false);
        }
      }}
    >
      {saved ? "★ My regular" : "☆ Save as a regular"}
    </Button>
  );
}
