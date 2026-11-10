import {
  commissionBpsFor,
  dayBounds,
  effectiveBps,
  formatCents,
  formatHour,
  isWithin,
  monthBounds,
  payoutLines,
  RULES,
  settledShopCents,
  summarizeSettled,
  weekBounds,
  type PayoutLine,
  type SettledOrder,
} from "@sippy/core";
import { api, Badge, Button, Card, colors, ErrorNote, Loading, Row, Screen, spacing, supabase, Text, useLoad } from "@sippy/mobile-ui";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";

const money = (c: number) => formatCents(c, { showZeroCents: true });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: RULES.timeZone });
const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });
const range = (start: string | Date, end: string | Date) => `${shortDate.format(new Date(start))} – ${shortDate.format(new Date(new Date(end).getTime() - 1))}`;

/** Pass sales, overages in green, deductions in red, then the net. */
function Lines({ lines }: { lines: PayoutLine[] }) {
  return (
    <View style={{ gap: 6 }}>
      {lines.map((l) => (
        <Row
          key={l.label}
          style={[
            { justifyContent: "space-between", gap: spacing.sm },
            l.kind === "total" && { borderTopWidth: 1, borderTopColor: colors.latte, paddingTop: spacing.sm },
          ]}
        >
          <Text variant={l.kind === "total" ? "bodyBold" : "body"} color={l.kind === "minus" ? colors.danger : colors.espresso} style={{ flexShrink: 1 }}>
            {l.label}
          </Text>
          <Text variant="bodyBold" color={l.kind === "plus" ? colors.success : l.kind === "minus" ? colors.danger : colors.espresso}>
            {l.kind === "plus" ? "+" : l.kind === "minus" ? "−" : ""}
            {money(l.cents)}
          </Text>
        </Row>
      ))}
    </View>
  );
}

function Orders({ orders }: { orders: SettledOrder[] }) {
  if (!orders.length) return <Text color={colors.pecan}>No orders.</Text>;
  return (
    <View style={{ gap: spacing.sm }}>
      {orders.map((o) => (
        <View key={o.id} style={{ borderTopWidth: 1, borderTopColor: colors.latte, paddingTop: spacing.sm, gap: 2 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="bodyBold">{stamp.format(new Date(o.redeemedAt))}</Text>
            <Text>{money(o.totalCents)}</Text>
          </Row>
          <Text variant="small" color={colors.pecan}>
            {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
            {o.status === "no_show" ? " · not picked up" : ""}
          </Text>
          <Text variant="small">
            Pass {money(o.passCoveredCents)}
            {o.overageCents > 0 ? <Text variant="small" color={colors.success}>{` · +${money(o.overageCents)} overage`}</Text> : null}
            <Text variant="small" color={colors.danger}>{` · −${money(o.commissionCents + o.overageCommissionCents + o.overageFeeCents)}`}</Text>
            {` · you get ${money(settledShopCents(o))}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A tappable row that opens to show a week's breakdown and orders. */
function WeekCard({ title, sub, cents, badge, lines, orders, initiallyOpen = false }: { title: string; sub: string; cents: number; badge?: string; lines: PayoutLine[]; orders: SettledOrder[]; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Card style={{ gap: spacing.md }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 48 }}>
        <Row style={{ justifyContent: "space-between", gap: spacing.sm }}>
          <View style={{ flexShrink: 1 }}>
            <Text variant="bodyBold">{title}</Text>
            <Text variant="small" color={colors.pecan}>
              {sub}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {badge ? <Badge label={badge} tone={badge === "paid" ? "success" : badge === "failed" ? "danger" : "latte"} /> : null}
            <Text variant="bodyBold">
              {money(cents)} {open ? "▴" : "▾"}
            </Text>
          </View>
        </Row>
      </Pressable>
      {open && (
        <>
          <Lines lines={lines} />
          <Text variant="bodyBold">Orders</Text>
          <Orders orders={orders} />
        </>
      )}
    </Card>
  );
}

function Payouts({ bps }: { bps: number }) {
  const p = useLoad(() => api.shopPayouts(), [], 120000);
  if (p.loading) return <Loading />;
  if (!p.data) return <ErrorNote message={p.error ?? "Couldn't load payouts."} onRetry={p.refresh} />;
  const cur = summarizeSettled(p.data.thisWeek.orders);
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="h1" accessibilityRole="header">
        Payouts
      </Text>
      <Text variant="small" color={colors.pecan}>
        Tap a week to see its orders. Sent to your bank every Monday.
      </Text>
      <WeekCard
        title="This week so far"
        sub={`${range(p.data.thisWeek.start, p.data.thisWeek.end)} · ${cur.orderCount} ${cur.orderCount === 1 ? "order" : "orders"}`}
        cents={cur.transferCents}
        lines={payoutLines(cur, bps)}
        orders={p.data.thisWeek.orders}
        initiallyOpen
      />
      {p.data.payouts.length === 0 ? (
        <Text color={colors.pecan}>No past payouts yet.</Text>
      ) : (
        p.data.payouts.map((w) => (
          <WeekCard
            key={w.id}
            title={range(w.periodStart, w.periodEnd)}
            sub={`${w.orderCount} ${w.orderCount === 1 ? "order" : "orders"}`}
            cents={w.transferCents}
            badge={w.status}
            lines={payoutLines(w, effectiveBps(w, bps))}
            orders={w.orders}
          />
        ))
      )}
    </View>
  );
}

function Stat({ label, value, sub, open, onPress }: { label: string; value: string; sub?: string; open?: boolean; onPress?: () => void }) {
  const body = (
    <Card style={{ gap: 2, borderWidth: 2, borderColor: open ? colors.espresso : "transparent" }}>
      <Text variant="small" color={colors.pecan}>
        {label}
      </Text>
      <Text variant="stat">{value}</Text>
      {sub && (
        <Text variant="small" color={colors.pecan}>
          {sub}
        </Text>
      )}
      {onPress && (
        <Text variant="small" color={colors.burntSugarInk} style={{ marginTop: 4 }}>
          {open ? "Hide details ▴" : "Details ▾"}
        </Text>
      )}
    </Card>
  );
  if (!onPress) return <View style={{ flexBasis: "47%", flexGrow: 1 }}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Details`} accessibilityState={{ expanded: !!open }} onPress={onPress} style={{ flexBasis: "47%", flexGrow: 1 }}>
      {body}
    </Pressable>
  );
}

export default function DashboardScreen() {
  const d = useLoad(() => api.shopStats(), [], 60000);
  const [open, setOpen] = useState<string | null>(null);
  if (d.loading) return <Screen><Loading /></Screen>;
  if (!d.data) return <Screen><ErrorNote message={d.error ?? "Couldn't load your dashboard."} onRetry={d.refresh} /></Screen>;
  const { stats, shop } = d.data;
  const recent = d.data.recent ?? [];
  const bps = commissionBpsFor(shop);
  const now = new Date();
  const inRange = (r: { start: Date; end: Date }) => recent.filter((o) => isWithin(new Date(o.redeemedAt), r));
  const sets: Record<string, { title: string; orders: SettledOrder[]; lines: boolean }> = {
    today: { title: "Today's orders", orders: inRange(dayBounds(now, RULES.timeZone)), lines: false },
    week: { title: "This week's orders", orders: inRange(weekBounds(now, RULES.timeZone)), lines: false },
    month: { title: "This month", orders: inRange(monthBounds(now, RULES.timeZone)), lines: true },
    payout: { title: "This week's payout so far", orders: inRange(weekBounds(now, RULES.timeZone)), lines: true },
  };
  const toggle = (k: string) => setOpen(open === k ? null : k);
  const detail = open ? sets[open] : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={d.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="small" color={colors.pecan}>
        {shop.name}
      </Text>
      <Text variant="display" accessibilityRole="header">
        Today
      </Text>
      {shop.removalReason === "food" ? (
        <Card style={{ gap: spacing.sm, borderWidth: 2, borderColor: colors.danger }}>
          <Text variant="h2" color={colors.danger}>
            Your shop was removed for selling food
          </Text>
          <Text>
            Sippy Brew is drinks only, with no exceptions. If this happened by genuine error rather than misrepresentation, you can appeal once from the web portal
            dashboard.
          </Text>
          {shop.appealedAt ? <Text variant="bodyBold">We have your appeal and will email you our decision.</Text> : null}
        </Card>
      ) : (
        shop.status !== "active" && <Badge label={shop.status === "pending" ? "Waiting for approval" : "Paused"} tone="danger" />
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        <Stat label="Redemptions today" value={String(stats.redemptions.today)} sub={money(stats.grossCents.today)} open={open === "today"} onPress={() => toggle("today")} />
        <Stat label="This week" value={String(stats.redemptions.week)} sub={money(stats.grossCents.week)} open={open === "week"} onPress={() => toggle("week")} />
        <Stat label="This month" value={String(stats.redemptions.month)} sub={money(stats.grossCents.month)} open={open === "month"} onPress={() => toggle("month")} />
        <Stat label="Est. payout this week" value={money(stats.estimatedWeeklyPayoutCents)} open={open === "payout"} onPress={() => toggle("payout")} />
      </View>
      {detail && (
        <Card style={{ gap: spacing.md, borderWidth: 2, borderColor: colors.espresso }}>
          <Text variant="h2">{detail.title}</Text>
          {detail.lines && <Lines lines={payoutLines(summarizeSettled(detail.orders), bps)} />}
          <Orders orders={detail.orders} />
        </Card>
      )}

      <Card style={{ gap: spacing.sm }}>
        <Text variant="h2">Top items</Text>
        {stats.topItems.length === 0 ? (
          <Text color={colors.pecan}>No redemptions this month yet.</Text>
        ) : (
          stats.topItems.map((i, n) => (
            <Row key={i.name} style={{ justifyContent: "space-between" }}>
              <Text>
                {n + 1}. {i.name}
              </Text>
              <Text variant="bodyBold">{i.quantity}</Text>
            </Row>
          ))
        )}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text variant="h2">Busiest hours</Text>
        {stats.busiestHours.length === 0 ? (
          <Text color={colors.pecan}>Not enough data yet.</Text>
        ) : (
          stats.busiestHours.slice(0, 4).map((h) => (
            <Row key={h.hour} style={{ justifyContent: "space-between" }}>
              <Text>{formatHour(h.hour)}</Text>
              <Text variant="bodyBold">{h.count}</Text>
            </Row>
          ))
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Stat label="New members" value={String(stats.members.new)} sub="this month" />
        <Stat label="Returning" value={String(stats.members.returning)} sub="this month" />
      </View>

      <Payouts bps={bps} />

      <Text variant="small" color={colors.pecan}>
        Onboarding, posts and full reports are on the web portal.
      </Text>
      <Button variant="danger" label="Sign out" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
