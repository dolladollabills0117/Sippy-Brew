/**
 * Builds the tappable demo into one self-contained page: demo/dist/sippy-brew-demo.html.
 *
 *   pnpm demo:build
 *
 * The page runs the real business rules: packages/core (passes, overage, commission, QR,
 * customizations, upgrades) is bundled straight from source, so the demo always matches the
 * app. The demo's own screens live in demo/src (app.js, app.css). Fonts load from Google Fonts;
 * everything else is inlined, so the file can be hosted anywhere or opened directly.
 */
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEAN_TILE_SVG, LOGO_SVG } from "../packages/core/src/logo";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

async function main() {
  // packages/core + the qrcode browser build, exposed as window.SippyCore.
  const bundled = await build({
    stdin: {
      contents: 'export * from "./packages/core/src/index";\nexport { toString as qrToSvg } from "qrcode/lib/browser";\n',
      resolveDir: root,
      sourcefile: "demo-entry.ts",
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    globalName: "SippyCore",
    target: "es2019",
    platform: "browser",
    minify: true,
    write: false,
  });
  const core = bundled.outputFiles[0]!.text;
  const css = readFileSync(join(here, "src/app.css"), "utf8");
  const js = readFileSync(join(here, "src/app.js"), "utf8");
  const beans = `url("data:image/svg+xml,${encodeURIComponent(BEAN_TILE_SVG)}")`;

  // The claude.ai artifact host adds its own <html>/<head>/<body> wrapper, so this file is
  // written as page content. Browsers render it the same when opened on its own.
  const page = `<title>Sippy Brew Demo</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Nunito:wght@400;600;700;800&display=swap">
<style>
:root { --beans: ${beans}; }
${css}
</style>
<div id="app" class="wrap"></div>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
<script>${core}</script>
<script>${js}</script>
`;
  mkdirSync(join(here, "dist"), { recursive: true });
  const out = join(here, "dist/sippy-brew-demo.html");
  writeFileSync(out, page);
  console.log(`Built ${out} (${Math.round(page.length / 1024)} KB)`);

  // GitHub Pages: a complete HTML document with share-preview tags, so a link pasted into
  // LinkedIn, Slack or iMessage shows the Sippy Brew card. Deployed by .github/workflows/pages.yml.
  const site = process.env.PAGES_URL ?? "https://dolladollabills0117.github.io/Sippy-Brew/";
  const title = "Sippy Brew: live app demo";
  const description = "One monthly pass. Any local coffee shop. Tap through the live demo: pick a pass, order ahead, customize your drink and show your pickup QR, or run a shop from the merchant portal.";
  const card = `${site}sippy-brew-card.png`;
  const meta = `<meta name="description" content="${description}">
<meta name="theme-color" content="#F3E5C7">
<link rel="canonical" href="${site}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sippy Brew">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${site}">
<meta property="og:image" content="${card}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="627">
<meta property="og:image:alt" content="Sippy Brew: Your neighborhood, brewed daily. Two phones show the member home screen and a pickup QR code.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${card}">`;
  const doc = `<!doctype html>
<html lang="en">
<head>
${page.slice(0, page.indexOf("<style>")).replace("<title>Sippy Brew Demo</title>", `<title>${title}</title>`)}${meta}
${page.slice(page.indexOf("<style>"), page.indexOf("</style>") + "</style>".length)}
<style>html,body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head>
<body>
${page.slice(page.indexOf("</style>") + "</style>".length).trim()}
</body>
</html>
`;
  writeFileSync(join(here, "dist/index.html"), doc);
  copyFileSync(join(root, "docs/marketing/sippy-brew-card.png"), join(here, "dist/sippy-brew-card.png"));
  writeFileSync(join(here, "dist/.nojekyll"), "");
  console.log(`Built ${join(here, "dist/index.html")} for GitHub Pages`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
