// Renders the generated header SVG to PNG for visual verification.
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";

const svgPath = process.argv[2] || "docs/assets/readme-header.svg";
const outPath = svgPath.replace(/\.svg$/, ".png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
await page.goto(pathToFileURL(svgPath).href, { waitUntil: "networkidle" });
await page.waitForTimeout(800); // let the webfont load
await page.screenshot({ path: outPath });
await browser.close();
console.log("rendered", outPath);
