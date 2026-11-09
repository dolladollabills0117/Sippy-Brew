import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Card, PageTitle, SkeletonList } from "@/components/ui";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const shop = role === "shop";
  return (
    <div className="mx-auto max-w-md">
      <PageTitle sub={shop ? "Set up your shop and start taking pickup orders." : "A few seconds, then pick your plan."}>
        {shop ? "List your shop" : "Get your pass"}
      </PageTitle>
      <Card>
        <Suspense fallback={<SkeletonList rows={3} />}>
          <AuthForm mode="signup" />
        </Suspense>
      </Card>
      <p className="mt-4 text-center text-sm text-pecan">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="font-bold text-burnt-sugar-ink underline underline-offset-4">Terms</Link>. Coffee shops make and serve your drinks; Sippy Brew runs the pass.
      </p>
      <p className="mt-6 text-center text-pecan">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-burnt-sugar-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
