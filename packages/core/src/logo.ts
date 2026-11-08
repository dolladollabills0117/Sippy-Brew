/**
 * The Sippy Brew mark, verbatim from the brand spec: a coffee cup seen from above. Cream rim
 * and handle on a saucer ring, an espresso surface, "SB" in cream foam (Caprasimo), and four
 * caramel bubbles. The same file is saved as apps/web/public/logo.svg.
 *
 * The app UI shows only this logo, never the "Sippy Brew" name as text. The name stays in the
 * accessible label, legal pages, emails and the README.
 *
 * `fontFamily` lets the Expo apps point the "SB" at the Caprasimo face they load with expo-font.
 */
export const LOGO_SVG = `<svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sippy Brew">
<circle cx="130" cy="130" r="124" fill="#D9C4A3"/>
<rect x="226" y="118" width="26" height="24" rx="10" fill="#FBF6EC" stroke="#B4A08A" stroke-width="2"/>
<circle cx="130" cy="130" r="108" fill="#FBF6EC" stroke="#B4A08A" stroke-width="2"/>
<circle cx="130" cy="130" r="90" fill="#3B2A1E"/>
<g fill="#C68E4E" opacity="0.5">
<circle cx="72" cy="88" r="6"/><circle cx="188" cy="80" r="4"/><circle cx="196" cy="184" r="7"/><circle cx="66" cy="176" r="5"/>
</g>
<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="Caprasimo, serif" font-size="66" fill="#F3E5C7" transform="translate(130 130) scale(0.94 1.16)">SB</text>
</svg>`;

export function logoSvg(opts: { size?: number | string; fontFamily?: string } = {}): string {
  let svg = LOGO_SVG;
  if (opts.size !== undefined) svg = svg.replace("<svg ", `<svg width="${opts.size}" height="${opts.size}" `);
  if (opts.fontFamily) svg = svg.replace('font-family="Caprasimo, serif"', `font-family="${opts.fontFamily}"`);
  return svg;
}

/** Background beans, verbatim from the brand spec (absolute, behind the page, aria-hidden). */
export const BACKGROUND_BEANS_SVG = `<svg aria-hidden="true" width="100%" height="100%">
<defs><pattern id="beans" width="180" height="180" patternUnits="userSpaceOnUse">
<g opacity="0.06">
<g transform="translate(30 40) rotate(20)"><ellipse rx="9" ry="6" fill="#241A13"/><path d="M-7 0 Q0 -3 7 0" fill="none" stroke="#FBF6EC" stroke-width="1.4" stroke-linecap="round"/></g>
<g transform="translate(120 110) rotate(-35)"><ellipse rx="9" ry="6" fill="#241A13"/><path d="M-7 0 Q0 -3 7 0" fill="none" stroke="#FBF6EC" stroke-width="1.4" stroke-linecap="round"/></g>
<g transform="translate(70 150) rotate(60)"><ellipse rx="9" ry="6" fill="#241A13"/><path d="M-7 0 Q0 -3 7 0" fill="none" stroke="#FBF6EC" stroke-width="1.4" stroke-linecap="round"/></g>
</g></pattern></defs>
<rect width="100%" height="100%" fill="url(#beans)"/>
</svg>`;
