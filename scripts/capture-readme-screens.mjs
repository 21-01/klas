// Captures real app screenshots for the README header banner.
// Requires the dev server on http://localhost:5173 (talks to the real Neon backend).
//
// Usage: node scripts/capture-readme-screens.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const PASSWORD = "klasdemo";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "assets", "screenshots");
mkdirSync(outDir, { recursive: true });

const shots = [
  {
    name: "desktop-admin",
    account: "admin@klas.unj.ac.id",
    viewport: { width: 1440, height: 900 }, // xl — persistent sidebar visible
    route: "/admin",
    settle: 1200,
  },
  {
    name: "mobile-mahasiswa",
    account: "ahmad.fauzi@mhs.unj.ac.id",
    viewport: { width: 390, height: 844 }, // sm-minus — phone frame + bottom nav
    route: "/mahasiswa",
    settle: 1200,
  },
];

const browser = await chromium.launch();

for (const shot of shots) {
  const ctx = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: 2, // retina-sharp text in the banner
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", shot.account);
  await page.fill("#password", PASSWORD);
  await page.click("button.w-full");
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}${shot.route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(shot.settle);
  const out = join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: out });
  console.log(`captured ${shot.name} (${shot.viewport.width}x${shot.viewport.height}) -> ${out}`);
  await ctx.close();
}

await browser.close();
