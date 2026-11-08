import { CupIcon } from "./ui";

/** The Sippy Brew mark: a cup on the Burnt Sugar → Cream Swirl gradient. */
export function Logo({ size = 40, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="hero-gradient grid place-items-center rounded-[14px] shadow-card" style={{ width: size, height: size }}>
        <CupIcon className="text-espresso" />
      </span>
      {withWord && <span className="font-heading text-2xl text-espresso">Sippy Brew</span>}
    </span>
  );
}
