import { getTier, planFor, QUIZ, type SubTierId, type Tier, type TierGroupId } from "../config";

export interface QuizResult {
  plan: Tier;
  /** "You're a Local!" */
  headline: string;
  emoji: string;
  /** The cheeky one-liner for this plan. */
  line: string;
  /** "20 coffees a month, up to $8 each" */
  summary: string;
}

/**
 * The "Get matched" quiz: what you usually order picks the sub-tier (House or Specialty), how
 * often you go picks the tier (Visitor, Regular or Local). Unknown answers fall back to the
 * defaults so a stale link never breaks.
 */
export function recommendPlan(answers: { drink?: string | null; often?: string | null }): Tier {
  const drink = QUIZ.drink.answers.find((a) => a.id === answers.drink);
  const often = QUIZ.often.answers.find((a) => a.id === answers.often);
  const sub: SubTierId = drink?.subTier ?? "double_shot";
  const tier: TierGroupId = often?.tier ?? "macchiato";
  return planFor(tier, sub);
}

export function quizResult(planOrId: Tier | string): QuizResult {
  const plan = typeof planOrId === "string" ? getTier(planOrId) : planOrId;
  const max = `$${(plan.maxPassValueCents / 100).toFixed(0)}`;
  return {
    plan,
    headline: `You're a ${plan.tierName}!`,
    emoji: plan.emoji,
    line: plan.resultLine,
    summary: `${plan.passesPerMonth} coffees a month, up to ${max} each`,
  };
}
