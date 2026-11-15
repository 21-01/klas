// Generates the README header image: KLAS brand + desktop dashboard mockup + mobile mockup.
// Output: docs/assets/readme-header.svg (pure SVG — renders everywhere GitHub does).
//
// Usage: node scripts/generate-readme-header.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "assets", "readme-header.svg");

// ── Brand tokens (app/app.css) ────────────────────────────────────────────
const P = "#00113a";      // brand-primary
const S = "#002366";      // brand-secondary
const CANVAS = "#f8f9ff"; // brand-canvas
const SURFACE = "#f0edf1";
const BORDER = "#c5c6d2";
const TEXT = "#00113a";
const DIM = "#5d5f5f";
const GREEN = "#22c55e";
const RED = "#ba1a1a";
const WHITE = "#ffffff";

const W = 1200, H = 600;

// KLAS diamond logo path (public/logo.svg), reusable at any size
const diamond = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M64 224L0 115.294H52.4609C53.8928 120.319 58.5152 124 64 124C69.4848 124 74.1072 120.319 75.5391 115.294H128L64 224ZM128 108.706H75.5391C74.1072 103.681 69.4848 100 64 100C58.5152 100 53.8928 103.681 52.4609 108.706H0L64 0L128 108.706Z" fill="${fill}"/>`;

// ── helpers ───────────────────────────────────────────────────────────────
const rect = (x, y, w, h, fill, rx = 0, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${rx}" ${extra}/>`;

const text = (x, y, str, size, fill, weight = 600, anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}" font-family="'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")}</text>`;

// dashboard stat card
function statCard(x, y, w, h, label, value, valueColor) {
  return [
    rect(x, y, w, h, WHITE, 12, `stroke="${BORDER}" stroke-opacity="0.7"`),
    text(x + 14, y + 24, label.toUpperCase(), 11, DIM, 700, "start", `letter-spacing="1"`),
    text(x + 14, y + 52, value, 26, valueColor, 800),
  ].join("");
}

// bar-chart column pair (present/absent)
function barPair(cx, baseY, maxH, present, absent, maxVal, label, showLabel) {
  const total = present + absent;
  const h = Math.max(4, (total / maxVal) * maxH);
  const hp = (present / maxVal) * maxH;
  const ha = (absent / maxVal) * maxH;
  const bw = 26;
  return [
    `<rect x="${cx - bw / 2}" y="${baseY - h}" width="${bw}" height="${hp}" fill="${S}" fill-opacity="0.85" rx="3"/>`,
    `<rect x="${cx - bw / 2}" y="${baseY - ha}" width="${bw}" height="${ha}" fill="${RED}" fill-opacity="0.35" rx="3"/>`,
    `<line x1="${cx - 26}" y1="${baseY + 6}" x2="${cx + 26}" y2="${baseY + 6}" stroke="${RED}" stroke-width="2"/>`,
    text(cx, baseY - h - 8, `${Math.round((present / Math.max(total, 1)) * 100)}%`, 11, P, 800, "middle"),
    showLabel
      ? text(cx, baseY + 24, label, 11, DIM, 600, "middle")
      : "",
  ].join("");
}

// ── desktop mockup (admin dashboard) ──────────────────────────────────────
function desktopMockup(x, y, w, h) {
  const parts = [];

  // window chrome
  parts.push(rect(x, y, w, h, CANVAS, 14, `stroke="${BORDER}"`));
  parts.push(rect(x, y, w, 44, WHITE, 14, `stroke="${BORDER}"`));
  parts.push(rect(x, y + 30, w, 14, WHITE)); // square off chrome bottom
  parts.push(`<circle cx="${x + 22}" cy="${y + 22}" r="6" fill="#ff5f57"/><circle cx="${x + 40}" cy="${y + 22}" r="6" fill="#febc2e"/><circle cx="${x + 58}" cy="${y + 22}" r="6" fill="#28c840"/>`);
  parts.push(rect(x + 78, y + 12, w - 156, 20, SURFACE, 10));
  parts.push(text(x + w / 2, y + 26, "klas-demo.vercel.app/admin", 11, DIM, 600, "middle"));

  // dark sidebar
  const sw = 170;
  parts.push(rect(x, y + 44, sw, h - 44, P));
  parts.push(diamond(x + 16, y + 58, 0.09, WHITE));
  parts.push(text(x + 40, y + 82, "KLAS", 15, WHITE, 800, "start", `letter-spacing="0.5"`));
  const nav = ["DASHBOARD", "MASTER DATA", "ATTENDANCE", "SCHEDULE", "AUDIT LOGS"];
  nav.forEach((item, i) => {
    const ny = y + 120 + i * 38;
    if (i === 0) parts.push(rect(x + 10, ny - 16, sw - 20, 32, WHITE, 8, `fill-opacity="0.14"`));
    parts.push(rect(x + 26, ny - 4, 8, 8, i === 0 ? WHITE : "rgba(255,255,255,0.35)", 2));
    parts.push(text(x + 44, ny + 4, item, 11, i === 0 ? WHITE : "rgba(255,255,255,0.65)", 700, "start", `letter-spacing="0.8"`));
  });

  // content column
  const cx0 = x + sw + 24;
  const cw = w - sw - 48;
  parts.push(text(cx0, y + 76, "Academic Analytics & Reports", 19, TEXT, 800, "start", `letter-spacing="-0.4"`));

  // 4 stat cards
  const gw = (cw - 36) / 4;
  const stats = [
    ["Sessions", "1", P],
    ["Attendance", "100%", P],
    ["Geofence", "1", RED],
    ["Students", "3", GREEN],
  ];
  stats.forEach(([label, value, color], i) => {
    parts.push(statCard(cx0 + i * (gw + 12), y + 92, gw, 66, label, value, color));
  });

  // chart card
  const chY = y + 172;
  const chH = h - 172 - 24;
  parts.push(rect(cx0, chY, cw, chH, WHITE, 12, `stroke="${BORDER}" stroke-opacity="0.7"`));
  parts.push(text(cx0 + 18, chY + 28, "Attendance Trends", 14, TEXT, 800));
  parts.push(text(cx0 + 18, chY + 46, "Daily attendance across all sessions", 10, DIM, 500));

  const baseY = chY + chH - 34;
  const maxH = chH - 84;
  const trend = [
    ["Nov 9", 0, 0], ["Nov 10", 0, 0], ["Nov 11", 0, 0],
    ["Nov 12", 0, 0], ["Nov 13", 1, 0], ["Nov 14", 0, 0],
  ];
  const maxVal = 1;
  const innerW = cw - 60;
  trend.forEach(([label, present, absent], i) => {
    const gap = innerW / trend.length;
    const cxm = cx0 + 30 + gap * i + gap / 2;
    parts.push(barPair(cxm, baseY, maxH, present, absent, maxVal, label, true));
  });

  return parts.join("");
}

// ── mobile mockup (student app) ───────────────────────────────────────────
function mobileMockup(x, y, w, h) {
  const parts = [];
  const r = 22;

  parts.push(rect(x, y, w, h, "#0b0f1a", r));
  parts.push(rect(x + 6, y + 6, w - 12, h - 12, CANVAS, 18));

  // top bar
  parts.push(rect(x + 6, y + 6, w - 12, 48, WHITE, 0));
  parts.push(rect(x + 6, y + 40, w - 12, 14, WHITE));
  parts.push(diamond(x + w / 2 - 7, y + 16, 0.065, P));
  parts.push(text(x + w / 2, y + 46, "KLAS", 11, P, 800, "middle", `letter-spacing="1"`));

  // content
  const pad = 18;
  const iw = w - pad * 2;
  parts.push(text(x + pad, y + 82, "FRIDAY, NOV 13", 9, DIM, 700, "start", `letter-spacing="1"`));
  parts.push(text(x + pad, y + 104, "Today's Active Class", 16, TEXT, 800, "start", `letter-spacing="-0.3"`));

  const cy = y + 122;
  parts.push(rect(x + pad, cy, iw, 96, WHITE, 12, `stroke="${BORDER}" stroke-opacity="0.8"`));
  parts.push(rect(x + pad + 14, cy + 16, 34, 20, "rgba(34,197,94,0.15)", 6));
  parts.push(text(x + pad + 31, cy + 30, "LIVE", 8, "#15803d", 800, "middle"));
  parts.push(text(x + pad + 14, cy + 56, "IK501 — Rekayasa", 12, TEXT, 800));
  parts.push(text(x + pad + 14, cy + 72, "Perangkat Lunak", 12, TEXT, 800));
  parts.push(text(x + pad + 14, cy + 86, "08:00–10:30 · GDS-506", 9, DIM, 600));
  parts.push(rect(x + pad + iw - 60, cy + 16, 46, 22, P, 8));
  parts.push(text(x + pad + iw - 37, cy + 31, "SCAN", 8, WHITE, 800, "middle", `letter-spacing="0.5"`));

  const sy = cy + 110;
  parts.push(rect(x + pad, sy, iw, 78, WHITE, 12, `stroke="${BORDER}" stroke-opacity="0.8"`));
  parts.push(rect(x + pad + 14, sy + 14, 44, 20, "rgba(0,35,102,0.08)", 6));
  parts.push(text(x + pad + 36, sy + 28, "UPCOMING", 8, S, 800, "middle"));
  parts.push(text(x + pad + 14, sy + 54, "IK502 — Teori Informasi", 13, TEXT, 800));
  parts.push(text(x + pad + 14, sy + 68, "Selasa · 08:00 – 10:30", 10, DIM, 600));

  const ay = sy + 92;
  parts.push(rect(x + pad, ay, iw, 54, WHITE, 12, `stroke="${BORDER}" stroke-opacity="0.8"`));
  parts.push(text(x + pad + 14, ay + 22, "ATTENDANCE RATE", 8, DIM, 700, "start", `letter-spacing="0.8"`));
  parts.push(text(x + pad + 14, ay + 44, "100%", 20, P, 800));
  parts.push(rect(x + pad + iw - 120, ay + 30, 100, 8, SURFACE, 4));
  parts.push(rect(x + pad + iw - 120, ay + 30, 100, 8, GREEN, 4));

  // bottom nav
  const navH = 56;
  const navY = y + h - 6 - navH;
  parts.push(rect(x + 6, navY, w - 12, navH, WHITE, 0));
  parts.push(`<line x1="${x + 6}" y1="${navY}" x2="${x + w - 6}" y2="${navY}" stroke="${BORDER}" stroke-opacity="0.6"/>`);
  const items = [
    ["Home", true], ["Logs", false], ["Profile", false],
  ];
  const step = (w - 12) / 3;
  items.forEach(([label, active], i) => {
    const mx = x + 6 + step * i + step / 2;
    if (active) parts.push(rect(mx - 26, navY + 6, 52, navH - 18, P, 10));
    const iy = navY + 16;
    if (i === 0) parts.push(`<path d="M${mx - 7} ${iy + 5} L${mx} ${iy - 2} L${mx + 7} ${iy + 5} V${iy + 11} H${mx - 7} Z" fill="${active ? WHITE : DIM}"/>`);
    if (i === 1) parts.push(`<rect x="${mx - 7}" y="${iy}" width="14" height="3" rx="1.5" fill="${active ? WHITE : DIM}"/><rect x="${mx - 7}" y="${iy + 5}" width="14" height="3" rx="1.5" fill="${active ? WHITE : DIM}"/><rect x="${mx - 7}" y="${iy + 10}" width="10" height="3" rx="1.5" fill="${active ? WHITE : DIM}"/>`);
    if (i === 2) parts.push(`<circle cx="${mx}" cy="${iy + 3}" r="4" fill="${active ? WHITE : DIM}"/><path d="M${mx - 7} ${iy + 13} Q${mx} ${iy + 5} ${mx + 7} ${iy + 13}" stroke="${active ? WHITE : DIM}" stroke-width="2.4" fill="none"/>`);
    parts.push(text(mx, navY + 44, label, 8, active ? WHITE : DIM, 700, "middle", `letter-spacing="0.6"`));
  });

  return parts.join("");
}

// ── compose header ────────────────────────────────────────────────────────
function compose() {
  const parts = [];

  parts.push(`<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${P}"/>
      <stop offset="0.55" stop-color="${S}"/>
      <stop offset="1" stop-color="#032262"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.15" cy="0.1" r="0.6">
      <stop offset="0" stop-color="rgba(255,255,255,0.10)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.9" cy="0.95" r="0.7">
      <stop offset="0" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,0.10)"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>`);

  parts.push(rect(0, 0, W, H, "url(#bg)"));
  parts.push(rect(0, 0, W, H, "url(#glow1)"));
  parts.push(rect(0, 0, W, H, "url(#glow2)"));
  parts.push(rect(0, 0, W, H, "url(#dots)"));

  // decorative diamonds
  parts.push(diamond(1040, 40, 0.16, "rgba(255,255,255,0.08)"));
  parts.push(diamond(1120, 470, 0.10, "rgba(255,255,255,0.06)"));
  parts.push(diamond(40, 500, 0.12, "rgba(255,255,255,0.05)"));

  // brand block — top-left
  parts.push(diamond(64, 44, 0.15, WHITE));
  parts.push(text(118, 96, "KLAS", 44, WHITE, 800, "start", `letter-spacing="1"`));
  parts.push(text(119, 124, "Your Location, Your Attendance", 15, "rgba(255,255,255,0.75)", 600, "start", `letter-spacing="1.5"`));

  parts.push(text(66, 168, "Geospatial Presence Verification", 17, WHITE, 800, "start", `letter-spacing="0.2"`));
  parts.push(text(66, 192, "Dynamic QR · GPS Geofencing · Campus IP Filter", 13, "rgba(255,255,255,0.65)", 600, "start"));

  const chips = ["React 19", "Neon Postgres", "Realtime", "Tailwind v4"];
  let chipX = 66;
  chips.forEach((c) => {
    const w = 22 + c.length * 7.6;
    parts.push(rect(chipX, 214, w, 28, "rgba(255,255,255,0.12)", 14, `stroke="rgba(255,255,255,0.25)"`));
    parts.push(text(chipX + w / 2, 233, c, 12, WHITE, 700, "middle"));
    chipX += w + 10;
  });

  // desktop mockup — right side
  const dw = 700, dh = 420;
  parts.push(`<g filter="url(#shadow)">`);
  parts.push(desktopMockup(W - dw - 48, 128, dw, dh));
  parts.push(`</g>`);

  // mobile mockup — overlapping desktop's left edge
  const mw = 196, mh = 390;
  parts.push(`<g filter="url(#shadow)">`);
  parts.push(mobileMockup(W - dw - 108, 180, mw, mh));
  parts.push(`</g>`);

  parts.push(text(66, H - 34, "Admin console (desktop)  ·  Student app (mobile)", 13, "rgba(255,255,255,0.55)", 600, "start"));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="KLAS banner: admin dashboard on desktop and student app on mobile">${parts.join("")}</svg>`;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, compose(), "utf8");
console.log(`wrote ${outPath} (${Math.round(compose().length / 1024)} KB)`);
