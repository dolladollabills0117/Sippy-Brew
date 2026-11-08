import { colors, fonts, radii, shadows, spacing, touchTarget } from "@sippy/core/brand";

export { colors, fonts, radii, shadows, spacing, touchTarget };

/**
 * Type scale in points. Text scales with iOS Dynamic Type and Android font size settings
 * (allowFontScaling stays on); maxScale caps only the biggest headings so layouts survive
 * the largest accessibility sizes.
 */
export const type = {
  display: { fontFamily: fonts.native.heading, fontSize: 34, lineHeight: 38, maxScale: 1.4 },
  h1: { fontFamily: fonts.native.heading, fontSize: 28, lineHeight: 32, maxScale: 1.6 },
  h2: { fontFamily: fonts.native.heading, fontSize: 22, lineHeight: 26, maxScale: 1.8 },
  body: { fontFamily: fonts.native.body, fontSize: 17, lineHeight: 24, maxScale: 2.5 },
  bodyBold: { fontFamily: fonts.native.bodyBold, fontSize: 17, lineHeight: 24, maxScale: 2.5 },
  small: { fontFamily: fonts.native.bodySemi, fontSize: 14, lineHeight: 20, maxScale: 2.5 },
  /** Button labels: 19pt extra-bold counts as "large text", so Cream on Burnt Sugar (4.3:1) passes AA. */
  button: { fontFamily: fonts.native.bodyExtraBold, fontSize: 19, lineHeight: 24, maxScale: 2 },
  stat: { fontFamily: fonts.native.bodyExtraBold, fontSize: 32, lineHeight: 38, maxScale: 1.6 },
} as const;

export type TypeVariant = keyof typeof type;
