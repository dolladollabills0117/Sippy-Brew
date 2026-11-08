import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg pt-16">
      <EmptyState title="We couldn't find that page" action={<ButtonLink href="/">Go home</ButtonLink>}>
        It may have moved, or the link may be old.
      </EmptyState>
    </div>
  );
}
