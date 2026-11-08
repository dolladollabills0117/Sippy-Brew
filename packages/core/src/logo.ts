import { colors } from "./brand";

/**
 * The Sippy Brew mark: a coffee cup seen from above. Cream rim and handle on a saucer ring,
 * an espresso surface, "SB" in cream foam, and four small caramel bubbles.
 *
 * One SVG source for every surface: the web header (inline), the Expo apps (react-native-svg
 * SvgXml) and the generated app icons. `fontFamily` lets each surface point at the Cherry Bomb
 * One face it has loaded.
 */
export function logoSvg(opts: { size?: number | string; fontFamily?: string; title?: string; background?: string } = {}): string {
  const size = opts.size ?? 48;
  const font = opts.fontFamily ?? "'Cherry Bomb One', ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif";
  const label = opts.title ?? "Sippy Brew";
  const c = colors;
  const saucer = "#EADBBE";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${label}">
  <title>${label}</title>
  ${opts.background ? `<rect width="120" height="120" fill="${opts.background}"/>` : ""}
  <circle cx="58" cy="60" r="55" fill="${saucer}"/>
  <circle cx="58" cy="60" r="54" fill="none" stroke="#CBB089" stroke-width="2.5"/>
  <circle cx="58" cy="60" r="45" fill="none" stroke="${c.latte}" stroke-width="2.5"/>
  <rect x="84" y="51" width="27" height="18" rx="9" fill="${c.creamSwirl}" stroke="${c.latte}" stroke-width="1.5"/>
  <circle cx="58" cy="60" r="38" fill="${c.creamSwirl}" stroke="${c.latte}" stroke-width="1.5"/>
  <circle cx="58" cy="60" r="31" fill="${c.espresso}"/>
  <circle cx="58" cy="60" r="31" fill="none" stroke="${c.pecan}" stroke-width="2.5" opacity=".9"/>
  <ellipse cx="58" cy="61" rx="21" ry="15" fill="${c.pecan}" opacity=".55"/>
  <text x="58" y="70" text-anchor="middle" font-family="${font}" font-size="27" fill="${c.creamSwirl}" letter-spacing="-.5">SB</text>
  <circle cx="40" cy="46" r="2.6" fill="${c.caramel}"/>
  <circle cx="45" cy="41" r="1.6" fill="${c.caramel}"/>
  <circle cx="76" cy="77" r="2.2" fill="${c.caramel}"/>
  <circle cx="71" cy="82" r="1.4" fill="${c.caramel}"/>
</svg>`;
}

/** A coffee bean outline, used for the scattered background and the dancing beans. */
export const BEAN_PATH =
  "M12 1.5C6.2 1.5 2 6.6 2 12.5S6.2 23.5 12 23.5 22 18.4 22 12.5 17.8 1.5 12 1.5Zm0 0c-2.8 3.4-3 6.7-.8 10.4 2.2 3.8 2 7.6-.6 11.4";
