/** WCAG 2.x relative luminance and contrast ratio. */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) throw new Error(`bad hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** AA: 4.5 for body text, 3 for large text (24px, or 18.66px bold) and UI components. */
export function meetsAA(fg: string, bg: string, kind: "text" | "large" | "ui" = "text"): boolean {
  return contrastRatio(fg, bg) >= (kind === "text" ? 4.5 : 3);
}
