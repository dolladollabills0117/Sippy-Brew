"use client";
import { formatCents, QUIZ, quizResult, recommendPlan } from "@sippy/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

type Answers = { drink?: string; often?: string };
const STEPS = [
  { key: "drink" as const, q: QUIZ.drink },
  { key: "often" as const, q: QUIZ.often },
];

/**
 * "Get matched": one question per card. Tapping an answer swipes the card away and the next one
 * slides in; after the last question comes a cheeky result with the recommended pass.
 */
export function QuizFlow() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [leaving, setLeaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  function answer(key: keyof Answers, id: string) {
    if (leaving) return;
    const next = { ...answers, [key]: id };
    setAnswers(next);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      setStep((s) => s + 1);
      window.scrollTo(0, 0);
    }, reduce ? 0 : 280);
  }

  if (step >= STEPS.length) {
    const r = quizResult(recommendPlan(answers));
    return (
      <section aria-labelledby="result-h" className="quiz-in flex flex-col items-center gap-4 rounded-[28px] bg-cream-swirl px-6 py-8 text-center shadow-card">
        <span aria-hidden="true" className="result-emoji text-7xl leading-none">
          {r.emoji}
        </span>
        <h1 id="result-h" ref={heading} tabIndex={-1} className="text-[2.6rem] leading-none text-burnt-sugar outline-none sm:text-5xl">
          {r.headline}
        </h1>
        <p className="max-w-[30ch] text-lg font-bold text-espresso">{r.line}</p>
        <div className="flex w-full flex-col items-center gap-1 rounded-[18px] bg-vanilla-bean p-4">
          <span className="rounded-full bg-honey px-2.5 py-0.5 text-xs font-extrabold text-espresso">Your match</span>
          <span className="font-heading text-2xl text-espresso">{r.plan.name}</span>
          <span className="text-pecan">{r.summary}</span>
          <span className="font-heading text-3xl text-espresso">
            {formatCents(r.plan.priceCents)}
            <span className="font-body text-base text-pecan">/month</span>
          </span>
        </div>
        <Link
          href={`/find-shops?plan=${r.plan.id}`}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-honey px-8 text-[1.1875rem] font-extrabold text-espresso shadow-card hover:bg-caramel"
        >
          Find my local shops
        </Link>
        <p className="text-sm text-pecan">Change your pass any time. Changes kick in at the start of your next month.</p>
        <p className="flex flex-wrap justify-center gap-x-3 text-sm font-bold">
          <button type="button" className="min-h-11 text-burnt-sugar-ink underline underline-offset-4" onClick={() => { setAnswers({}); setStep(0); }}>
            Retake the quiz
          </button>
          <Link href="/#passes" className="inline-flex min-h-11 items-center text-burnt-sugar-ink underline underline-offset-4">
            See all passes
          </Link>
        </p>
      </section>
    );
  }

  const { key, q } = STEPS[step]!;
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden px-0.5 py-1">
        <section aria-labelledby="quiz-q" className={cx("flex min-h-[380px] flex-col gap-5 rounded-[28px] bg-cream-swirl px-5 py-6 shadow-card", leaving ? "quiz-out" : "quiz-in")}>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-sky-blue px-3 py-0.5 text-xs font-extrabold text-espresso">
              Question {step + 1} of {STEPS.length}
            </span>
            <span aria-hidden="true" className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <i key={i} className={cx("h-1.5 w-6 rounded-full", i <= step ? "bg-burnt-sugar" : "bg-latte")} />
              ))}
            </span>
          </div>
          <h1 id="quiz-q" ref={heading} tabIndex={-1} className="text-[2rem] leading-tight text-espresso outline-none sm:text-4xl">
            {q.question}
          </h1>
          <div className="flex flex-col gap-2.5">
            {q.answers.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => answer(key, a.id)}
                className={cx(
                  "flex min-h-16 w-full flex-col items-start rounded-[18px] border-2 px-4 py-3 text-left text-lg transition-transform active:scale-[.98]",
                  answers[key] === a.id ? "border-espresso bg-sky-blue" : "border-latte bg-vanilla-bean hover:border-pecan",
                )}
              >
                <span className="font-bold text-espresso">{a.label}</span>
                <span className="text-sm text-pecan">{a.hint}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      {step > 0 && (
        <button type="button" onClick={() => setStep(step - 1)} className="min-h-11 self-start font-bold text-burnt-sugar-ink">
          ‹ Back
        </button>
      )}
      <Link href="/#passes" className="inline-flex min-h-11 items-center justify-center font-bold text-burnt-sugar-ink">
        Skip, show me all the passes
      </Link>
    </div>
  );
}
