import { RedeemScanner } from "@/components/RedeemScanner";
import { PageTitle } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem" };

export default async function RedeemPage() {
  await requireOwnerShop("/shop/redeem");
  return (
    <>
      <PageTitle sub="Scan the member's QR code, or type the 6-character code under it.">Redeem</PageTitle>
      <RedeemScanner />
    </>
  );
}
