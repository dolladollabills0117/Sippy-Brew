import { CONSENT_LABEL, purchaseSummary, type Tier } from "@sippy/core";
import Link from "next/link";

/**
 * Before paying: price, renewal, expiry, refunds and cancellation in plain words, and a required
 * "I agree" checkbox. The server refuses checkout without the agreement.
 */
export function PurchaseSummary({ plan, agreed, onAgree }: { plan: Tier; agreed: boolean; onAgree: (v: boolean) => void }) {
  const s = purchaseSummary(plan);
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border-2 border-espresso bg-vanilla-bean p-4">
      <p className="font-heading text-xl text-espresso">{s.title}</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-espresso">
        {s.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <label htmlFor="agree" className="flex min-h-11 cursor-pointer items-start gap-3 font-bold text-espresso">
        <input id="agree" type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-burnt-sugar" checked={agreed} onChange={(e) => onAgree(e.target.checked)} />
        <span>
          {CONSENT_LABEL.split("Terms of Service")[0]}
          <Link href="/terms" target="_blank" className="underline underline-offset-4">
            Terms of Service
          </Link>
          {CONSENT_LABEL.split("Terms of Service")[1]}
        </span>
      </label>
    </div>
  );
}
