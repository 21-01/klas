// Generates the README header banner from REAL app screenshots.
// Prerequisite: run `node scripts/capture-readme-screens.mjs` first (needs dev server on :5173).
// Output: docs/assets/readme-header.svg (self-contained — screenshots embedded as base64).
//
// Usage: node scripts/generate-readme-header.mjs
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "docs", "assets", "readme-header.svg");
const desktopPng = join(here, "..", "docs", "assets", "screenshots", "desktop-admin.png");
const mobilePng = join(here, "..", "docs", "assets", "screenshots", "mobile-mahasiswa.png");

for (const p of [desktopPng, mobilePng]) {
  if (!existsSync(p)) {
    console.error(`missing ${p}\nrun: node scripts/capture-readme-screens.mjs (dev server must be on :5173)`);
    process.exit(1);
  }
}

// ── Brand tokens (app/app.css) ────────────────────────────────────────────
const P = "#00113a";
const S = "#002366";
const WHITE = "#ffffff";
const W = 1400, H = 640;
// preview viewport matches the canvas (render-svg-preview reads this via env)
process.env.SVG_PREVIEW_W = String(W);
process.env.SVG_PREVIEW_H = String(H);

// KLAS diamond logo path (public/logo.svg)
const diamond = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M64 224L0 115.294H52.4609C53.8928 120.319 58.5152 124 64 124C69.4848 124 74.1072 120.319 75.5391 115.294H128L64 224ZM128 108.706H75.5391C74.1072 103.681 69.4848 100 64 100C58.5152 100 53.8928 103.681 52.4609 108.706H0L64 0L128 108.706Z" fill="${fill}"/>`;

const text = (x, y, str, size, fill, weight = 600, anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}" font-family="'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")}</text>`;

const b64 = (p) => readFileSync(p).toString("base64");

// browser chrome above a screenshot (rounded window + traffic lights + url pill)
function browserChrome(x, y, w, url) {
  const h = 34;
  return [
    `<path d="M${x + 14} ${y} h${w - 28} a14 14 0 0 1 14 14 v${h - 14} h-${w} v-${h - 14} a14 14 0 0 1 14-14 z" fill="#ffffff"/>`,
    `<circle cx="${x + 22}" cy="${y + h / 2}" r="5.5" fill="#ff5f57"/>`,
    `<circle cx="${x + 38}" cy="${y + h / 2}" r="5.5" fill="#febc2e"/>`,
    `<circle cx="${x + 54}" cy="${y + h / 2}" r="5.5" fill="#28c840"/>`,
    `<rect x="${x + w / 2 - 130}" y="${y + h / 2 - 10}" width="260" height="20" rx="10" fill="#f0edf1"/>`,
    text(x + w / 2, y + h / 2 + 4, url, 12, "#5d5f5f", 600, "middle"),
  ].join("");
}

function compose() {
  const parts = [];

  parts.push(`<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${P}"/>
      <stop offset="0.55" stop-color="${S}"/>
      <stop offset="1" stop-color="#032262"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.12" cy="0.08" r="0.55">
      <stop offset="0" stop-color="rgba(255,255,255,0.10)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.92" cy="0.95" r="0.65">
      <stop offset="0" stop-color="rgba(255,255,255,0.07)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,0.10)"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    <!-- mobile screenshot clipped to the bezel's inner radius (34 display px = 66 viewBox units) -->
    <clipPath id="mobScreen"><rect x="0" y="0" width="390" height="844" rx="66"/></clipPath>
  </defs>`);

  parts.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#glow1)"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#glow2)"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#dots)"/>`);

  // decorative diamonds
  parts.push(diamond(1290, 36, 0.14, "rgba(255,255,255,0.08)"));
  parts.push(diamond(1330, 540, 0.10, "rgba(255,255,255,0.06)"));
  parts.push(diamond(46, 540, 0.11, "rgba(255,255,255,0.05)"));

  // ── brand block — left column ──
  parts.push(diamond(64, 64, 0.16, WHITE));
  parts.push(text(122, 118, "KLAS", 50, WHITE, 800, "start", `letter-spacing="1"`));
  parts.push(text(123, 148, "Your Location, Your Attendance", 16, "rgba(255,255,255,0.75)", 600, "start", `letter-spacing="1.5"`));

  parts.push(text(66, 208, "Geospatial Presence", 21, WHITE, 800, "start", `letter-spacing="-0.2"`));
  parts.push(text(66, 236, "Verification System", 21, WHITE, 800, "start", `letter-spacing="-0.2"`));
  parts.push(text(66, 270, "Dynamic QR · GPS Geofencing · Campus IP Filter", 14, "rgba(255,255,255,0.65)", 600, "start"));

  // ── desktop mockup — center-right (sidebar unobstructed) ──
  // screenshot is 1440x900 (2x scale = 2880x1800 actual px)
  const dw = 620;                    // display width
  const dh = Math.round((dw * 900) / 1440); // 388
  const dx = 500, dy = 150;
  const chromeH = 34;
  const shotScale = dw / 1440;       // display px per screenshot CSS px
  const shotH = Math.round(900 * shotScale);

  parts.push(`<g filter="url(#shadow)">`);
  // window body: chrome + screenshot, rounded top
  parts.push(`<path d="M${dx + 14} ${dy} h${dw - 28} a14 14 0 0 1 14 14 v${dh + chromeH - 14} h-${dw} v-${dh + chromeH - 14} a14 14 0 0 1 14-14 z" fill="#ffffff"/>`);
  parts.push(browserChrome(dx, dy, dw, "klas-demo.vercel.app/admin"));
  // nested svg crops the screenshot to the window and scales it — no clip-path transform math
  parts.push(`<svg x="${dx}" y="${dy + chromeH}" width="${dw}" height="${dh}" viewBox="0 0 1440 ${Math.round(dh / shotScale)}" preserveAspectRatio="xMidYMin slice">
    <image href="data:image/png;base64,${b64(desktopPng)}" x="0" y="0" width="1440" height="900"/>
  </svg>`);
  parts.push(`</g>`);
  // border
  parts.push(`<path d="M${dx + 14} ${dy} h${dw - 28} a14 14 0 0 1 14 14 v${dh + chromeH - 14} h-${dw} v-${dh + chromeH - 14} a14 14 0 0 1 14-14 z" fill="none" stroke="rgba(255,255,255,0.25)"/>`);

  // ── mobile mockup — right of desktop, phone bezel ──
  // screenshot is 390x844 (2x = 780x1688 actual px)
  const mw = 200;                    // display width
  const mh = Math.round((mw * 844) / 390); // 433
  const bezel = 8;
  const mx = dx + dw + 28;
  const my = 140;

  parts.push(`<g filter="url(#shadow)">`);
  parts.push(`<rect x="${mx - bezel}" y="${my - bezel}" width="${mw + bezel * 2}" height="${mh + bezel * 2}" rx="42" fill="#0b0f1a"/>`);
  parts.push(`<svg x="${mx}" y="${my}" width="${mw}" height="${mh}" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice" clip-path="url(#mobScreen)">
    <image href="data:image/png;base64,${b64(mobilePng)}" x="0" y="0" width="390" height="844"/>
  </svg>`);
  parts.push(`</g>`);
  parts.push(`<rect x="${mx - bezel}" y="${my - bezel}" width="${mw + bezel * 2}" height="${mh + bezel * 2}" rx="42" fill="none" stroke="rgba(255,255,255,0.25)"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="KLAS banner: admin dashboard on desktop and student app on mobile, real screenshots">${parts.join("")}</svg>`;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, compose(), "utf8");
console.log(`wrote ${outPath} (${Math.round(compose().length / 1024)} KB)`);
