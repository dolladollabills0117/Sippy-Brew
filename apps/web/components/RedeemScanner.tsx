"use client";
import type { Order } from "@sippy/core";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card, Field, inputClass } from "./ui";

type Result = { tone: "success" | "error"; title: string; order?: Order };

/** Camera QR scanner (ZXing) with manual code entry as a fallback. */
export function RedeemScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const lastScan = useRef<{ text: string; at: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(input: { qr?: string; shortCode?: string }) {
    setBusy(true);
    try {
      const { order } = await api.redeem(input);
      setResult({ tone: "success", title: `Redeemed for ${order.memberFirstName}`, order });
      setCode("");
    } catch (e) {
      setResult({ tone: "error", title: e instanceof ApiError ? e.message : "Couldn't redeem. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setCamError(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      setScanning(true);
      controls.current = await reader.decodeFromVideoDevice(undefined, video.current!, (res) => {
        if (!res) return;
        const text = res.getText();
        const now = Date.now();
        // Ignore the same code seen again within 3 seconds.
        if (lastScan.current && lastScan.current.text === text && now - lastScan.current.at < 3000) return;
        lastScan.current = { text, at: now };
        void submit({ qr: text });
      });
    } catch {
      setScanning(false);
      setCamError("Camera unavailable. Allow camera access, or type the member's code below.");
    }
  }

  function stop() {
    controls.current?.stop();
    controls.current = null;
    setScanning(false);
  }

  useEffect(() => () => controls.current?.stop(), []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="flex flex-col gap-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-espresso">
          <video ref={video} className="h-full w-full object-cover" muted playsInline aria-label="Camera preview" />
          {!scanning && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-cream-swirl">
              <p className="font-bold">Point the camera at the member&apos;s QR code.</p>
            </div>
          )}
          {scanning && <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-sky-blue" />}
        </div>
        {scanning ? (
          <Button variant="secondary" onClick={stop}>
            Stop camera
          </Button>
        ) : (
          <Button onClick={start}>Start scanning</Button>
        )}
        {camError && <Alert tone="error">{camError}</Alert>}
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit({ shortCode: code });
            }}
          >
            <Field id="code" label="Enter code instead" hint="The 6 characters under the member's QR.">
              <input
                id="code"
                className={`${inputClass} font-mono text-2xl uppercase tracking-[0.3em]`}
                value={code}
                maxLength={7}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy || code.replace(/\W/g, "").length !== 6}>
              Redeem code
            </Button>
          </form>
        </Card>
        {result && (
          <div aria-live="assertive">
            <Alert tone={result.tone}>
              <p className="text-xl">{result.title}</p>
              {result.order && (
                <ul className="mt-1 font-normal text-espresso">
                  {result.order.items.map((i) => (
                    <li key={i.id}>
                      {i.quantity}× {i.name} ({i.size}){i.options.length ? ` · ${i.options.map((o) => o.name).join(", ")}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}
