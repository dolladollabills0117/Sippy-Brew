/**
 * Sippy Brew brand tokens. Used by the web app (Tailwind theme + CSS variables) and both
 * Expo apps (StyleSheet). Change a color here and every surface follows.
 */
export const colors = {
  espresso: "#3B2A1E", // primary text, dark surfaces
  pecan: "#6B4F3A", // secondary text, icons, form-field borders
  burntSugar: "#A8642F", // primary buttons and calls to action
  /**
   * Accessibility addition: Burnt Sugar is 4.30:1 on Cream Swirl, just under AA for body text.
   * Use this deeper shade whenever Burnt Sugar would be small text (links, prices) or the
   * background of small-label buttons. 5.76:1 on Cream Swirl, 4.98:1 on Vanilla Bean.
   */
  burntSugarInk: "#8E5226",
  caramel: "#C68E4E", // hover states, highlights (pair with Espresso text, not Cream)
  honey: "#E0A847", // "Get my pass" call to action, with Espresso text
  latte: "#D9C4A3", // borders, dividers, soft backgrounds, headline glow
  vanillaBean: "#F3E5C7", // main page background
  creamSwirl: "#FBF6EC", // cards and surfaces
  skyBlue: "#87CEEB", // accent only: active states, badges, focus rings
  danger: "#9B2C2C",
  success: "#2F6B3A",
} as const;

export type ColorName = keyof typeof colors;

export const gradient = {
  /** Burnt Sugar into Cream Swirl — cream blending into coffee. Hero sections, logo background. */
  hero: { from: colors.burntSugar, to: colors.creamSwirl, angleDeg: 160 },
  css: `linear-gradient(160deg, ${colors.burntSugar} 0%, ${colors.caramel} 35%, ${colors.creamSwirl} 100%)`,
  stops: [colors.burntSugar, colors.caramel, colors.creamSwirl] as const,
} as const;

export const fonts = {
  heading: "Cherry Bomb One",
  body: "Nunito",
  /** expo-font family names registered by the mobile apps. */
  native: {
    heading: "CherryBombOne_400Regular",
    body: "Nunito_400Regular",
    bodySemi: "Nunito_600SemiBold",
    bodyBold: "Nunito_700Bold",
    bodyExtraBold: "Nunito_800ExtraBold",
  },
} as const;

export const radii = { sm: 12, md: 14, lg: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Soft, warm shadows tinted with Espresso, never harsh black. */
export const shadows = {
  card: "0 6px 24px -8px rgba(59, 42, 30, 0.18), 0 2px 6px rgba(59, 42, 30, 0.06)",
  lift: "0 14px 40px -12px rgba(59, 42, 30, 0.28)",
  native: {
    card: { shadowColor: colors.espresso, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  },
} as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const touchTarget = { min: 48 } as const;

/**
 * Focus ring. Sky Blue alone is only 1.6:1 on light surfaces, below the 3:1 needed for focus
 * indicators, so it is drawn with an Espresso outline beside it.
 */
export const focusRing = {
  css: `0 0 0 3px ${colors.skyBlue}, 0 0 0 5px ${colors.espresso}`,
} as const;

export const brand = { colors, gradient, fonts, radii, spacing, shadows, touchTarget, focusRing } as const;
export default brand;
