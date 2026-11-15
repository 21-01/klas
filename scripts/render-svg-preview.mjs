// Renders an SVG to PNG for visual verification.
// Usage: node scripts/render-svg-preview.mjs [path] (defaults to docs/assets/readme-header.svg)
// Viewport follows the SVG's width/height attributes (so tall/wide SVGs fit).
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const svgPath = process.argv[2] || "docs/assets/readme-header.svg";
const outPath = svgPath.replace(/\.svg$/, ".png");

// read width/height from the svg root tag
const svg = readFileSync(svgPath, "utf8");
const wMatch = svg.match(/width="(\d+)"/);
const hMatch = svg.match(/height="(\d+)"/);
const width = wMatch ? Number(wMatch[1]) : 1200;
const height = hMatch ? Number(hMatch[1]) : 600;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(pathToFileURL(svgPath).href, { waitUntil: "networkidle" });
await page.waitForTimeout(800); // let the webfont load
await page.screenshot({ path: outPath });
await browser.close();
console.log(`rendered ${outPath} (${width}x${height})`);
