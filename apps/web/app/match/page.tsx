import { QuizFlow } from "@/components/QuizFlow";

export const metadata = { title: "Get matched" };

export default function MatchPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 pt-2 sm:pt-6">
      <QuizFlow />
    </div>
  );
}
