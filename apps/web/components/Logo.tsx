import { LOGO_SVG } from "@sippy/core/logo";

/**
 * The logo, inlined from the brand SVG (also saved as public/logo.svg). The app shows only the
 * mark, never the name as text; the SVG's accessible label carries the name.
 */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <span
      className="logo inline-block shrink-0 [&_svg]:h-full [&_svg]:w-full"
      style={{ width: size, height: size }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: LOGO_SVG }}
    />
  );
}
