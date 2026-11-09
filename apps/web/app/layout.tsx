import { PLATFORM_ROLE_SHORT } from "@sippy/core";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { Caprasimo, Nunito } from "next/font/google";
import { colors, focusRing, gradient, shadows } from "@sippy/core/brand";
import { BEAN_TILE_SVG } from "@sippy/core/logo";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
// Headings and the "SB" in the logo.
const caprasimo = Caprasimo({ weight: "400", subsets: ["latin"], variable: "--font-caprasimo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Sippy Brew", template: "%s · Sippy Brew" },
  description: "One monthly coffee membership for your neighborhood's independent coffee shops.",
};

export const viewport: Viewport = { themeColor: colors.vanillaBean, width: "device-width", initialScale: 1 };

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const brandVars = [
  ...Object.entries(colors).map(([k, v]) => `--brand-${kebab(k)}:${v};`),
  `--brand-gradient:${gradient.css};`,
  `--brand-shadow-card:${shadows.card};`,
  `--brand-shadow-lift:${shadows.lift};`,
  `--brand-focus-ring:${focusRing.css};`,
  // Scattered coffee beans behind every page, as a repeating CSS background tile.
  `--brand-bean-tile:url("data:image/svg+xml,${encodeURIComponent(BEAN_TILE_SVG)}");`,
].join("");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${caprasimo.variable}`}>
      <head>
        <style>{`:root{${brandVars}}`}</style>
      </head>
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-cream-swirl focus:px-4 focus:py-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-pecan sm:px-6">
          <p>
            © {new Date().getFullYear()} · Coffee only. Daily Passes reset monthly and do not roll over. ·{" "}
            <Link href="/terms" className="font-bold underline underline-offset-4">Terms</Link>
          </p>
          <p className="mt-1">{PLATFORM_ROLE_SHORT}</p>
        </footer>
      </body>
    </html>
  );
}
