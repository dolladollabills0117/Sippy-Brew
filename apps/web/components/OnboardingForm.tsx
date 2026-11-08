"use client";
import { RULES, WEEKDAYS, type LatLng, type Shop, type ShopHours, type Weekday } from "@sippy/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Alert, Badge, Button, buttonClass, Card, Field, inputClass, SectionTitle } from "./ui";

const ShopMap = dynamic(() => import("./ShopMap").then((m) => m.ShopMap), { ssr: false, loading: () => <div className="skeleton h-[260px]" /> });

const DAYS: Record<Weekday, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const ORDERED: Weekday[] = [...WEEKDAYS.slice(1), WEEKDAYS[0]!];
const DEFAULT_HOURS: ShopHours = Object.fromEntries(ORDERED.map((d) => [d, d === "sun" ? { open: "08:00", close: "14:00" } : { open: "07:00", close: "17:00" }]));

export function OnboardingForm({ shop, userId }: { shop: Shop | null; userId: string }) {
  const router = useRouter();
  const [name, setName] = useState(shop?.name ?? "");
  const [address, setAddress] = useState(shop?.address ?? "");
  const [point, setPoint] = useState<LatLng | null>(shop ? { lat: shop.lat, lng: shop.lng } : null);
  const [story, setStory] = useState(shop?.story ?? "");
  const [hours, setHours] = useState<ShopHours>(shop?.hours && Object.keys(shop.hours).length ? shop.hours : DEFAULT_HOURS);
  const [photoUrl, setPhotoUrl] = useState<string | null>(shop?.photoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.size > 5_000_000) return setMsg({ tone: "error", text: "Use a JPG or PNG under 5 MB." });
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
    const sb = supabaseBrowser();
    const { error } = await sb.storage.from("shop-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return setMsg({ tone: "error", text: "Upload failed. Try again." });
    setPhotoUrl(sb.storage.from("shop-photos").getPublicUrl(path).data.publicUrl);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!point) return setMsg({ tone: "error", text: "Tap the map to place your shop." });
    setBusy(true);
    setMsg(null);
    try {
      await api.saveShop({ name, address, lat: point.lat, lng: point.lng, hours, story, photoUrl });
      setMsg({ tone: "success", text: "Saved." });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    try {
      window.location.assign((await api.connectOnboarding()).url);
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't open Stripe." });
    }
  }

  function setDay(d: Weekday, v: { open: string; close: string } | null) {
    setHours((h) => ({ ...h, [d]: v }));
  }

  return (
    <div className="flex flex-col gap-6">
      {shop && (
        <p className="flex items-center gap-2 text-espresso">
          Status: <Badge tone={shop.status === "active" ? "success" : shop.status === "paused" ? "danger" : "latte"}>{shop.status}</Badge>
        </p>
      )}
      <form onSubmit={save} className="flex flex-col gap-6">
        <Card className="grid gap-4 md:grid-cols-2">
          <Field id="s-name" label="Business name">
            <input id="s-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field id="s-address" label="Street address">
            <input id="s-address" className={inputClass} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </Field>
          <div className="md:col-span-2">
            <p className="mb-1.5 font-bold text-espresso">Location on the map</p>
            <ShopMap pins={point ? [{ id: "me", label: name || "Your shop", ...point }] : []} selectedId="me" onPick={setPoint} height={260} label="Tap to place your shop" />
            <p className="mt-1 text-sm text-pecan">{point ? "Got it. Tap again to move the pin." : "Tap your shop's spot on the map."}</p>
          </div>
          <div className="md:col-span-2">
            <Field id="s-story" label="Your story" hint={`${story.length}/${RULES.shopStoryMaxChars} characters`}>
              <textarea id="s-story" rows={3} maxLength={RULES.shopStoryMaxChars} className={inputClass} value={story} onChange={(e) => setStory(e.target.value)} required />
            </Field>
          </div>
          <Field id="s-photo" label="Photo" hint="A bright photo of your counter or storefront.">
            <input id="s-photo" type="file" accept="image/*" className="text-espresso file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-latte file:px-4 file:font-bold" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </Field>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Shop photo preview" className="h-32 w-full rounded-2xl object-cover" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-2xl text-espresso">Hours</h2>
          <ul className="flex flex-col gap-2">
            {ORDERED.map((d) => {
              const h = hours[d];
              return (
                <li key={d} className="grid grid-cols-[6.5rem_auto_1fr] items-center gap-3">
                  <span className="font-bold text-espresso">{DAYS[d]}</span>
                  <label className="inline-flex items-center gap-2 text-sm text-espresso">
                    <input type="checkbox" className="h-5 w-5 accent-burnt-sugar" checked={Boolean(h)} onChange={(e) => setDay(d, e.target.checked ? { open: "07:00", close: "17:00" } : null)} />
                    Open
                  </label>
                  {h ? (
                    <div className="flex items-center gap-2">
                      <input type="time" aria-label={`${DAYS[d]} opens`} className={`${inputClass} max-w-36`} value={h.open} onChange={(e) => setDay(d, { ...h, open: e.target.value })} />
                      <span aria-hidden="true">–</span>
                      <input type="time" aria-label={`${DAYS[d]} closes`} className={`${inputClass} max-w-36`} value={h.close} onChange={(e) => setDay(d, { ...h, close: e.target.value })} />
                    </div>
                  ) : (
                    <span className="text-pecan">Closed</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit" disabled={busy} className="self-start">
          {shop ? "Save changes" : "Create my shop"}
        </Button>
      </form>

      {shop && (
        <>
          <SectionTitle>
            <span id="payouts">Payouts</span>
          </SectionTitle>
          <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-espresso">
              {shop.payoutsEnabled
                ? "Stripe is connected. Payouts go to your bank every Monday."
                : "Connect a Stripe Express account to receive weekly payouts to your bank. Takes about 5 minutes."}
            </p>
            <Button variant={shop.payoutsEnabled ? "secondary" : "primary"} onClick={connect}>
              {shop.payoutsEnabled ? "Update payout details" : "Connect with Stripe"}
            </Button>
          </Card>
          <SectionTitle>Menu</SectionTitle>
          <Card className="flex items-center justify-between gap-3">
            <p className="text-espresso">Add your coffee menu. Food items aren&apos;t allowed.</p>
            <Link href="/shop/menu" className={buttonClass("secondary")}>
              Set up menu
            </Link>
          </Card>
        </>
      )}
    </div>
  );
}
