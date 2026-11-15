// Headless verification of the 404 page.
import { chromium } from "playwright-core";

const BASE = "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${BASE}/this-page-does-not-exist`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
console.log("url:", page.url());
console.log("title:", await page.title());
console.log("has 404 heading:", await page.getByText("This page wandered off campus").isVisible());
await page.screenshot({ path: "screenshots-verify/404-desktop.png" });

// Mobile check
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/some/unknown/deep/path`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log("mobile overflowX:", overflow);
await page.screenshot({ path: "screenshots-verify/404-mobile.png" });

// Known route still works
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
console.log("home title:", await page.title());

await browser.close();
