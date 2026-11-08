import { getSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { listShops } from "@/lib/member";

export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  const near = url.searchParams.get("near");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  return json(
    await listShops(await getSession(req), {
      near: near === "home" || near === "work" ? near : undefined,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    }),
  );
});
