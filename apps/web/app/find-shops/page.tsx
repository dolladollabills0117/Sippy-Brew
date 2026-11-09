import { LocalShops } from "@/components/LocalShops";
import { PageTitle } from "@/components/ui";
import { isConfigured } from "@/lib/env";
import { listShops } from "@/lib/member";

export const metadata = { title: "Your local coffee shops" };
export const dynamic = "force-dynamic";

export default async function FindShopsPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const shops = isConfigured() ? (await listShops(null).catch(() => ({ shops: [] }))).shops : [];
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-2 pt-2 sm:pt-6">
      <PageTitle>Your local coffee shops</PageTitle>
      <LocalShops plan={plan} shops={shops.map((s) => ({ id: s.id, name: s.name, address: s.address, lat: s.lat, lng: s.lng }))} />
    </div>
  );
}
