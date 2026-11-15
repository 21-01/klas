// Headless verification of the admin dashboard layout at multiple viewports.
// Logs in through the real Neon auth, captures screenshots + overflow checks.
import { chromium } from "playwright-core";

const BASE = "http://localhost:5173";
const EMAIL = "admin@klas.unj.ac.id";
const PASSWORD = "KlasDemo#2026";
const OUT = "screenshots-verify";

import fs from "node:fs";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Login once; cookies persist in the context for subsequent pages.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click("button.w-full");
await page.waitForURL("**/admin", { timeout: 20000 });
console.log("logged in ->", page.url());

const viewports = [
  { name: "xl", width: 1440, height: 900 },
  { name: "lg", width: 1024, height: 800 },
  { name: "md", width: 768, height: 900 },
  { name: "sm", width: 640, height: 900 },
  { name: "sm-minus", width: 390, height: 844 },
];

const results = [];
for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1
  );
  await page.screenshot({ path: `${OUT}/admin-${vp.name}.png`, fullPage: false });
  results.push({ viewport: vp.name, width: vp.width, pageOverflowX: overflow });
  console.log(vp.name, "overflowX:", overflow);
}

console.log(JSON.stringify(results, null, 1));
await browser.close();
