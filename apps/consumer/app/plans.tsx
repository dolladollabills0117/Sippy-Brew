import { CONSENT_LABEL, DEFAULT_SUB_TIER, getTier, DEFAULT_TIER_GROUP, formatCents, purchaseSummary, QUIZ, quizResult, recommendPlan, RULES, SUB_TIERS, TIER_GROUPS, type SubTierId, type Tier, type TierId } from "@sippy/core";
import { api, Badge, Button, Card, Chip, colors, ErrorNote, errorMessage, radii, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, Switch, View } from "react-native";

/** Before paying: price, renewal, expiry and cancellation, and a required "I agree". */
function PurchaseSummary({ plan, agreed, onAgree }: { plan: Tier; agreed: boolean; onAgree: (v: boolean) => void }) {
  const s = purchaseSummary(plan);
  return (
    <View style={{ gap: spacing.sm, borderWidth: 2, borderColor: colors.espresso, borderRadius: radii.lg, padding: spacing.md, backgroundColor: colors.vanillaBean, alignSelf: "stretch" }}>
      <Text variant="bodyBold">{s.title}</Text>
      {s.lines.map((l) => (
        <Text key={l} variant="small">
          • {l}
        </Text>
      ))}
      <Row style={{ justifyContent: "space-between", minHeight: 48 }}>
        <Text variant="bodyBold" style={{ flex: 1 }} nativeID="agree-label">
          {CONSENT_LABEL}
        </Text>
        <Switch accessibilityLabelledBy="agree-label" value={agreed} onValueChange={onAgree} trackColor={{ true: colors.burntSugar, false: colors.latte }} />
      </Row>
    </View>
  );
}

type Answers = { drink?: string; often?: string };
const STEPS = [
  { key: "drink" as const, q: QUIZ.drink },
  { key: "often" as const, q: QUIZ.often },
];
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: RULES.timeZone });

/**
 * Plans. New members start with "Get matched": one question per card, each card swipes away
 * when answered, then a cheeky result with the recommended pass. "See all passes" shows the
 * labelled picker. Stripe Checkout opens in an in-app browser session; card numbers never touch
 * the app. Opened with ?change=1 by a member, picking a plan schedules it for next month.
 */
export default function PlansScreen() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  const changing = change === "1";
  const me = useLoad(() => (changing ? api.me() : Promise.resolve(null)), [changing]);
  const sub = me.data?.subscription ?? null;

  const [mode, setMode] = useState<"quiz" | "result" | "all">(changing ? "all" : "quiz");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [subTier, setSubTier] = useState<SubTierId>(DEFAULT_SUB_TIER);
  const [busy, setBusy] = useState<TierId | null>(null);
  // Required before paying (the server checks too). The plan the member has selected to buy.
  const [agreed, setAgreed] = useState(false);
  const [buying, setBuying] = useState<TierId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const current = SUB_TIERS.find((s) => s.id === subTier)!;

  async function choose(plan: TierId) {
    setBusy(plan);
    setError(null);
    try {
      if (changing && sub) {
        await api.changePlan(plan);
        router.replace("/account");
        return;
      }
      if (!agreed) {
        setBuying(plan);
        setBusy(null);
        return;
      }
      const { url } = await api.checkout(plan, "sippybrew://account", true);
      const result = await WebBrowser.openAuthSessionAsync(url, "sippybrew://account");
      if (result.type === "success" && result.url.includes("checkout=success")) router.replace("/");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function answer(key: keyof Answers, id: string) {
    const next = { ...answers, [key]: id };
    setAnswers(next);
    const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    const advance = () => {
      if (step + 1 < STEPS.length) setStep(step + 1);
      else {
        setSubTier(recommendPlan(next).subTier);
        setMode("result");
      }
    };
    if (reduce) return advance();
    Animated.timing(slide, { toValue: -1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      advance();
      slide.setValue(1);
      Animated.timing(slide, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  }

  const cardMotion = {
    opacity: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [
      { translateX: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [-420, 0, 220] }) },
      { rotate: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-7deg", "0deg", "4deg"] }) },
    ],
  };

  if (mode === "quiz") {
    const { key, q } = STEPS[step]!;
    return (
      <Screen>
        <Animated.View style={cardMotion}>
          <Card style={{ gap: spacing.lg, minHeight: 380 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Badge label={`Question ${step + 1} of ${STEPS.length}`} />
            </Row>
            <Text variant="display" accessibilityRole="header">
              {q.question}
            </Text>
            {q.answers.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${a.label}. ${a.hint}`}
                onPress={() => answer(key, a.id)}
                style={({ pressed }) => ({
                  minHeight: 64,
                  justifyContent: "center",
                  borderRadius: radii.lg,
                  borderWidth: 2,
                  borderColor: answers[key] === a.id ? colors.espresso : colors.latte,
                  backgroundColor: answers[key] === a.id ? colors.skyBlue : colors.vanillaBean,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Text variant="bodyBold">{a.label}</Text>
                <Text variant="small" color={colors.pecan}>
                  {a.hint}
                </Text>
              </Pressable>
            ))}
          </Card>
        </Animated.View>
        {step > 0 && <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} />}
        <Button label="Skip, show me all the passes" variant="ghost" onPress={() => setMode("all")} />
      </Screen>
    );
  }

  if (mode === "result") {
    const r = quizResult(recommendPlan(answers));
    return (
      <Screen>
        <Card style={{ gap: spacing.md, alignItems: "center" }}>
          <Text style={{ fontSize: 68, lineHeight: 80 }} accessibilityElementsHidden importantForAccessibility="no">
            {r.emoji}
          </Text>
          <Text variant="display" color={colors.burntSugar} accessibilityRole="header" style={{ textAlign: "center" }}>
            {r.headline}
          </Text>
          <Text variant="bodyBold" style={{ textAlign: "center" }}>
            {r.line}
          </Text>
          <View style={{ backgroundColor: colors.vanillaBean, borderRadius: radii.lg, padding: spacing.lg, alignItems: "center", gap: 4, alignSelf: "stretch" }}>
            <Badge label="Your match" tone="latte" />
            <Text variant="h2">{r.plan.name}</Text>
            <Text color={colors.pecan}>{r.summary}</Text>
            <Text variant="stat">
              {formatCents(r.plan.priceCents)}
              <Text color={colors.pecan}> / month</Text>
            </Text>
          </View>
          {error && <ErrorNote message={error} />}
          <PurchaseSummary plan={r.plan} agreed={agreed} onAgree={setAgreed} />
          <Button label={`Get my pass · ${formatCents(r.plan.priceCents)}/mo`} loading={busy === r.plan.id} disabled={busy !== null || !agreed} onPress={() => choose(r.plan.id)} />
          <Text variant="small" color={colors.pecan} style={{ textAlign: "center" }}>
            Change your pass any time. Changes kick in at the start of your next month. After you join, the Shops tab maps every participating shop within{" "}
            {RULES.maxRadiusMiles} miles.
          </Text>
          <Row style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Button label="Retake the quiz" variant="ghost" onPress={() => { setAnswers({}); setStep(0); setMode("quiz"); }} />
            <Button label="See all passes" variant="ghost" onPress={() => setMode("all")} />
          </Row>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="h1" accessibilityRole="header">
        {changing ? "Change your pass" : "Choose your pass"}
      </Text>
      {changing && sub && (
        <Text color={colors.pecan}>
          Your new pass starts with your next month, on {dateFmt.format(new Date(sub.currentPeriodEnd))}. This month stays as it is, and there&apos;s no charge today.
        </Text>
      )}
      {!changing && <Button label="Not sure? Get matched in two taps" variant="secondary" onPress={() => { setStep(0); setMode("quiz"); }} />}
      <Text variant="bodyBold">1. What do you usually order?</Text>
      <Row accessibilityRole="radiogroup" style={{ flexWrap: "wrap" }}>
        {SUB_TIERS.map((s) => (
          <Chip key={s.id} label={`${s.name} · up to ${formatCents(s.maxPassValueCents)}`} selected={subTier === s.id} onPress={() => setSubTier(s.id)} />
        ))}
      </Row>
      <Text color={colors.pecan}>
        {current.examples}. {current.blurb}
      </Text>
      <Text variant="bodyBold">2. How often do you go?</Text>
      {error && <ErrorNote message={error} />}
      {!changing && buying && (
        <Card style={{ gap: spacing.sm }}>
          <PurchaseSummary plan={getTier(buying)} agreed={agreed} onAgree={setAgreed} />
          <Button label={`Continue to payment · ${formatCents(getTier(buying).priceCents)}/mo`} disabled={!agreed || busy !== null} loading={busy === buying} onPress={() => choose(buying)} />
          <Button label="Pick a different pass" variant="ghost" onPress={() => setBuying(null)} />
        </Card>
      )}
      {TIER_GROUPS.map((g) => {
        const plan = g.plans[subTier];
        const hl = g.id === DEFAULT_TIER_GROUP;
        const isCurrent = sub?.tier === plan.id;
        return (
          <Card key={g.id} accent={hl} style={{ gap: spacing.sm }}>
            {hl && <Badge label="Most popular" />}
            <Text variant="h2">{g.name}</Text>
            <Text variant="stat">
              {formatCents(plan.priceCents)}
              <Text color={colors.pecan}> / month</Text>
            </Text>
            <Text>
              {plan.passesPerMonth} coffees a month · up to {formatCents(plan.maxPassValueCents)} each
            </Text>
            <Text variant="small" color={colors.pecan}>
              {g.frequency}. Unused passes don’t roll over.
            </Text>
            <Button
              label={isCurrent ? "Your current pass" : changing ? `Switch to ${plan.name} next month` : `Choose ${plan.name}`}
              variant={hl ? "primary" : "secondary"}
              loading={busy === plan.id}
              disabled={busy !== null || isCurrent}
              onPress={() => choose(plan.id)}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
