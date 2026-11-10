"use client";
import { RULES, type MemberSummary } from "@sippy/core";
import { useState } from "react";
import { Card, cx } from "./ui";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: RULES.timeZone });

/** Neighborhood Passport (+ Grand Tour) and Invite friends. */
export function RewardsCards({ summary }: { summary: MemberSummary }) {
  const r = summary.rewards;
  if (!r) return null;
  const p = r.passport;
  const gt = p.grandTour;
  const stamps = Math.min(p.visited, p.goal);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl text-espresso">Neighborhood Passport</h3>
          {p.passportEarned && <span className="rounded-full bg-honey px-2.5 py-0.5 text-xs font-extrabold text-espresso">Stamped!</span>}
        </div>
        <p className="text-espresso">
          {p.passportEarned
            ? "You've visited 5 local shops and earned a free day pass. Keep exploring!"
            : `Pick up at ${p.goal} different shops and get a free day pass.`}
        </p>
        <ol className="flex gap-2" aria-label={`${stamps} of ${p.goal} shops visited`}>
          {Array.from({ length: p.goal }, (_, i) => (
            <li
              key={i}
              aria-hidden="true"
              className={cx(
                "grid h-10 w-10 place-items-center rounded-full border-2 text-lg",
                i < stamps ? "border-burnt-sugar bg-burnt-sugar text-cream-swirl" : "border-dashed border-pecan text-pecan",
              )}
            >
              {i < stamps ? "☕" : i + 1}
            </li>
          ))}
        </ol>
        <div className="rounded-xl bg-vanilla-bean px-3 py-2.5 text-sm text-espresso">
          <b>🏆 Grand Tour:</b>{" "}
          {gt.earned
            ? `done! ${RULES.grandTourFreeMonths} months of your plan are on us.`
            : gt.unlocked
              ? `visit every participating shop and get ${RULES.grandTourFreeMonths} months free. ${gt.visitedCounting} of ${gt.countingShops} visited.`
              : `visit every shop for ${RULES.grandTourFreeMonths} months free. Unlocks once more than ${gt.minShops - 1} shops join (${gt.liveShops} so far).`}
        </div>
      </Card>
      <InviteCard summary={summary} />
    </div>
  );
}

function InviteCard({ summary }: { summary: MemberSummary }) {
  const ref = summary.rewards!.referral;
  const [copied, setCopied] = useState(false);
  async function share() {
    if (!ref.link) return;
    const text = "I get my coffee at local shops with Sippy Brew. Join with my link:";
    try {
      if (navigator.share) await navigator.share({ title: "Sippy Brew", text, url: ref.link });
      else {
        await navigator.clipboard.writeText(ref.link);
        setCopied(true);
      }
    } catch {
      /* dismissed */
    }
  }
  const joinedThisRound = RULES.referralFriendsNeeded - ref.friendsToNext;
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-xl text-espresso">Bring {RULES.referralFriendsNeeded} friends, get {ref.passesPerReward} passes</h3>
      <p className="text-espresso">
        When {RULES.referralFriendsNeeded} friends join with your link and start their pass, you get {ref.passesPerReward} bonus passes. Bonus passes roll over for a year.
      </p>
      <p className="text-sm font-bold text-pecan">
        {joinedThisRound} of {RULES.referralFriendsNeeded} friends joined{ref.rewardsEarned ? ` · ${ref.rewardsEarned * ref.passesPerReward} bonus passes earned so far` : ""}
      </p>
      {ref.code && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-vanilla-bean px-3 py-2 font-bold tracking-wider text-espresso">{ref.code}</code>
          <button type="button" onClick={share} className="min-h-11 rounded-full bg-espresso px-5 font-bold text-cream-swirl hover:bg-pecan">
            {copied ? "Link copied!" : "Share my link"}
          </button>
        </div>
      )}
    </Card>
  );
}

/** "+3 bonus passes · roll over until …" under the monthly passes. */
export function BonusLine({ summary }: { summary: MemberSummary }) {
  if (!summary.bonusPassesLeft) return null;
  return (
    <p className="mt-2 text-sm font-bold text-espresso">
      + {summary.bonusPassesLeft} bonus pass{summary.bonusPassesLeft === 1 ? "" : "es"}
      {summary.bonusExpiresAt && <span className="font-normal text-pecan"> · {summary.bonusPassesLeft === 1 ? "rolls" : "roll"} over until {dateFmt.format(new Date(summary.bonusExpiresAt))}</span>}
    </p>
  );
}
