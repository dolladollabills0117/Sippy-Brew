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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEAN_TILE_SVG } from "../packages/core/src/logo";

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
