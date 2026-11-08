import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { createPost, shopPosts } from "@/lib/shop";

export const GET = route(async (req: Request) => json({ posts: await shopPosts(await requireApiSession(req, "shop_owner")) }));

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "shop_owner");
  const { body } = await readJson<{ body?: string }>(req);
  return json({ post: await createPost(s, String(body ?? "")) }, { status: 201 });
});
