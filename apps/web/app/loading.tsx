import { SkeletonList } from "@/components/ui";

export default function Loading() {
  return (
    <div className="pt-10">
      <div className="skeleton mb-6 h-12 w-64" />
      <SkeletonList rows={4} />
    </div>
  );
}
