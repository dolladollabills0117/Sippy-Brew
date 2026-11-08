"use client";
import { Button, EmptyState } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg pt-16">
      <EmptyState title="Something spilled" action={<Button onClick={reset}>Try again</Button>}>
        We hit a problem loading this page.
      </EmptyState>
    </div>
  );
}
