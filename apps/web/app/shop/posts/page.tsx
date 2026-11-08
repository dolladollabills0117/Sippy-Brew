import { PostComposer } from "@/components/PostComposer";
import { PageTitle } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";
import { shopPosts } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Message board" };

export default async function PostsPage() {
  const { session, shop } = await requireOwnerShop("/shop/posts");
  return (
    <>
      <PageTitle sub="Post one daily special or announcement. Members who saved your shop get a notification.">Message board</PageTitle>
      <PostComposer initial={await shopPosts(session)} canPost={shop.status === "active"} />
    </>
  );
}
