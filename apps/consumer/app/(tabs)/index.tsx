import { formatHours, formatMiles, RULES, zonedParts, type ShopListItem } from "@sippy/core";
import { api, Badge, Card, Chip, colors, EmptyState, ErrorNote, Loading, radii, Row, Screen, spacing, Text, UpgradeCard, useLoad } from "@sippy/mobile-ui";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";

type Filter = "all" | "home" | "work";

function ShopRow({ shop }: { shop: ShopListItem }) {
  const today = zonedParts(new Date(), RULES.timeZone).weekday;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shop.name}, ${shop.openNow ? "open now" : "closed"}${shop.distanceMiles !== null ? `, ${formatMiles(shop.distanceMiles)}` : ""}`}
      onPress={() => router.push(`/shop/${shop.id}`)}
    >
      {({ pressed }) => (
        <Card style={{ gap: 4, opacity: pressed ? 0.85 : 1 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="h2" style={{ flex: 1 }}>
              {shop.name}
            </Text>
            {shop.saved && <Badge label="Regular" />}
          </Row>
          <Text variant="small" color={colors.pecan}>
            {shop.address}
          </Text>
          <Text variant="small">
            {shop.openNow ? "Open now" : "Closed"} · {formatHours(shop.hours[today])}
            {shop.distanceMiles !== null ? ` · ${formatMiles(shop.distanceMiles)}` : ""}
          </Text>
          <Text variant="small" color={colors.pecan} numberOfLines={2}>
            {shop.story}
          </Text>
        </Card>
      )}
    </Pressable>
  );
}

export default function ShopsTab() {
  const [filter, setFilter] = useState<Filter>("all");
  const shops = useLoad(() => api.listShops(filter === "all" ? {} : { near: filter }), [filter]);
  const me = useLoad(() => api.me(), []);
  const areas = me.data?.areas ?? [];
  const list = shops.data?.shops ?? [];
  const area = areas.find((a) => a.kind === filter);
  const first = list[0];

  return (
    <Screen refreshControl={<RefreshControl refreshing={shops.refreshing} onRefresh={shops.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="display" accessibilityRole="header">
        Shops
      </Text>
      {me.data?.upgrade?.suggested && <UpgradeCard upgrade={me.data.upgrade} passesLeft={me.data.passesLeft} nudge onDone={me.reload} />}
      <Row style={{ flexWrap: "wrap" }}>
        <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label="Near home" selected={filter === "home"} disabled={!areas.some((a) => a.kind === "home")} onPress={() => setFilter("home")} />
        <Chip label="Near work" selected={filter === "work"} disabled={!areas.some((a) => a.kind === "work")} onPress={() => setFilter("work")} />
      </Row>
      {areas.length < 2 && (
        <Text variant="small" color={colors.pecan}>
          Save your home and work areas on the Account tab to filter by neighborhood.
        </Text>
      )}

      <View style={{ height: 240, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.latte }} accessibilityLabel="Map of participating shops">
        <MapView
          style={{ flex: 1 }}
          region={
            area
              ? { latitude: area.lat, longitude: area.lng, latitudeDelta: area.radiusMiles / 25, longitudeDelta: area.radiusMiles / 25 }
              : first
                ? { latitude: first.lat, longitude: first.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }
                : { latitude: 40.735, longitude: -74.03, latitudeDelta: 0.08, longitudeDelta: 0.08 }
          }
        >
          {area && <Circle center={{ latitude: area.lat, longitude: area.lng }} radius={area.radiusMiles * 1609} strokeColor={colors.espresso} fillColor="rgba(135,206,235,0.2)" />}
          {list.map((s) => (
            <Marker key={s.id} coordinate={{ latitude: s.lat, longitude: s.lng }} title={s.name} pinColor={colors.burntSugar} onCalloutPress={() => router.push(`/shop/${s.id}`)} />
          ))}
        </MapView>
      </View>

      {shops.loading ? (
        <Loading label="Loading shops" />
      ) : shops.error ? (
        <ErrorNote message={shops.error} onRetry={shops.refresh} />
      ) : list.length === 0 ? (
        <EmptyState title="No shops here yet" body={filter === "all" ? "We're signing up shops near you." : "No shops in this area. Try a bigger radius."} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {shops.data?.spotlights.length && filter === "all" ? (
            <Text variant="h2" accessibilityRole="header">
              Nearby
            </Text>
          ) : null}
          {list.map((s) => (
            <ShopRow key={s.id} shop={s} />
          ))}
        </View>
      )}
    </Screen>
  );
}
