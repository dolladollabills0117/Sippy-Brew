import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Card, PageTitle, SkeletonList } from "@/components/ui";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle>Welcome back</PageTitle>
      <Card>
        <Suspense fallback={<SkeletonList rows={3} />}>
          <AuthForm mode="login" />
        </Suspense>
      </Card>
      <p className="mt-6 text-center text-pecan">
        New here?{" "}
        <Link href="/signup" className="font-bold text-burnt-sugar-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
