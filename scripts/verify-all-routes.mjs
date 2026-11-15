// Sweep every route x viewport: login per role, check page-level and element-level
// horizontal overflow, collect console errors, screenshot anything suspicious.
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = "http://localhost:5173";
const PASSWORD = "KlasDemo#2026";
const OUT = "screenshots-verify/sweep";
fs.mkdirSync(OUT, { recursive: true });

const JADWAL = "f0000000-0000-0000-0000-000000000001";

const roleRoutes = {
  admin: [
    "/admin",
    "/admin/master-data",
    "/admin/attendance",
    `/admin/attendance/${JADWAL}`,
    `/admin/attendance/${JADWAL}/sessions`,
    `/admin/attendance/correction/${JADWAL}`,
    "/admin/schedule",
    "/admin/audit-logs",
  ],
  dosen: [
    "/dosen",
    "/dosen/attendance",
    `/dosen/attendance/${JADWAL}`,
    `/dosen/attendance/${JADWAL}/sessions`,
    `/dosen/attendance/correction/${JADWAL}`,
    "/dosen/report",
    "/dosen/account-settings",
  ],
  mahasiswa: [
    "/mahasiswa",
    "/mahasiswa/logs",
    "/mahasiswa/profile",
    "/mahasiswa/scanner",
  ],
};

const accounts = {
  admin: "admin@klas.unj.ac.id",
  dosen: "samudra.adi@unj.ac.id",
  mahasiswa: "nandana.ammar@mhs.unj.ac.id",
};

const viewports = [
  { name: "xl", width: 1440, height: 900 },
  { name: "lg", width: 1024, height: 800 },
  { name: "md", width: 768, height: 900 },
  { name: "390", width: 390, height: 844 },
];

const browser = await chromium.launch();
const findings = [];

for (const role of Object.keys(roleRoutes)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (err) => consoleErrors.push("PAGEERROR: " + String(err).slice(0, 200)));

  // login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", accounts[role]);
  await page.fill("#password", PASSWORD);
  await page.click("button.w-full");
  await page.waitForTimeout(1500);

  // One authenticated request warms the JWT cache before the sweep, so the
  // per-route 401s seen during the first visit after login are not counted.
  await page.goto(roleRoutes[role][0], { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  for (const route of roleRoutes[role]) {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 15000 });
      } catch {
        // SPA may keep loading long-polls; continue with what rendered
      }
      await page.waitForTimeout(500);

      const check = await page.evaluate(() => {
        const vw = window.innerWidth;
        const pageOverflow = document.documentElement.scrollWidth > vw + 1;
        // find widest element right-edge beyond viewport
        let widest = null;
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed") {
            if (!widest || r.right > widest.right) {
              widest = {
                right: Math.round(r.right),
                tag: el.tagName.toLowerCase(),
                cls: String(el.className).slice(0, 80),
              };
            }
          }
        }
        return { vw, pageOverflow, widest };
      });

      if (check.pageOverflow || check.widest) {
        const shot = `${OUT}/${role}${route.replace(/\//g, "_")}-${vp.name}.png`;
        await page.screenshot({ path: shot });
        findings.push({
          role, route, vp: vp.name,
          pageOverflow: check.pageOverflow,
          widest: check.widest,
          shot,
        });
      }
    }
  }

  if (consoleErrors.length) {
    findings.push({ role, consoleErrors: [...new Set(consoleErrors)].slice(0, 5) });
  }
  await ctx.close();
}

await browser.close();
if (findings.length === 0) {
  console.log("CLEAN: no overflow or console errors on any route x viewport");
} else {
  console.log(JSON.stringify(findings, null, 1));
}
