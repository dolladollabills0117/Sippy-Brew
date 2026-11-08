import type { Metadata, Viewport } from "next";
import { Cherry_Bomb_One, Nunito } from "next/font/google";
import { colors, focusRing, gradient, shadows } from "@sippy/core/brand";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const cherryBomb = Cherry_Bomb_One({ weight: "400", subsets: ["latin"], variable: "--font-cherry-bomb", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

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
].join("");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cherryBomb.variable} ${nunito.variable}`}>
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
          <p>© {new Date().getFullYear()} Sippy Brew · Coffee only. Daily Passes reset monthly and do not roll over.</p>
        </footer>
      </body>
    </html>
  );
}
