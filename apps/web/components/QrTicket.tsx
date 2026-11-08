"use client";
import { colors } from "@sippy/core/brand";
import { qrSecondsRemaining, type QrTicket as Ticket } from "@sippy/core";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button } from "./ui";

/**
 * The member's pickup QR. Codes expire after 30 seconds, so this fetches a fresh one a few
 * seconds before expiry while the screen is visible. Large, high-contrast and quiet-zoned
 * for fast scanning.
 */
export function QrTicket({ orderId, active }: { orderId: string; active: boolean }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [svg, setSvg] = useState<string>("");
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const t = await api.issueQr(orderId);
      setTicket(t);
      setError(null);
      setSvg(await QRCode.toString(t.payload, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: colors.espresso, light: "#FFFFFF" } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your code. Check your connection.");
    }
  }, [orderId]);

  useEffect(() => {
    if (!active) return;
    void refresh();
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, refresh]);

  useEffect(() => {
    if (!ticket) return;
    const tick = () => {
      const s = qrSecondsRemaining(ticket.expiresAt, new Date());
      setLeft(s);
      if (s <= 4) void refresh();
      else timer.current = setTimeout(tick, 1000);
    };
    tick();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ticket, refresh]);

  if (!active) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-full max-w-[min(88vw,420px)] rounded-[20px] bg-white p-3 shadow-lift [&_svg]:h-auto [&_svg]:w-full"
        role="img"
        aria-label="Pickup QR code. Show this to the barista."
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {!svg && !error && <div className="skeleton aspect-square w-full max-w-[420px]" />}
      {ticket && (
        <div className="text-center">
          <p className="text-sm font-bold text-pecan">Or tell the barista this code</p>
          <p className="font-mono text-4xl font-extrabold tracking-[0.3em] text-espresso">{ticket.shortCode}</p>
          <p className="mt-1 text-sm text-pecan" aria-live="polite">
            Refreshes in {left}s
          </p>
        </div>
      )}
      {error && (
        <>
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </>
      )}
      <p className="max-w-sm text-center text-sm text-pecan">Turn your screen brightness up for the fastest scan.</p>
    </div>
  );
}
