// Diagnose the 401: log in as admin via the UI, then call get-my-profile from the page context.
import { chromium } from "playwright-core";

const BASE = "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const httpFailures = [];
page.on("response", (r) => {
  if (r.status() >= 400) httpFailures.push(`${r.status()} ${r.url().slice(0, 130)}`);
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "admin@klas.unj.ac.id");
await page.fill("#password", "klasdemo");
await page.click("button.w-full");
await page.waitForURL("**/admin", { timeout: 20000 });
console.log("logged in ->", page.url());

httpFailures.length = 0;
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("failures on /admin:", httpFailures.length ? httpFailures.join(" | ") : "none");

const tokenOk = await page.evaluate(async () => {
  const { getAccessToken } = await import("/app/lib/auth.ts").catch(() => ({}));
  return typeof getAccessToken === "function" ? "module loaded" : "module not reachable";
});
console.log("token module:", tokenOk);

// Direct API call with the cookie flow the app uses: check what getSession returns
const sessionState = await page.evaluate(async () => {
  const authUrl = "https://ep-winter-hat-az4t5c3x.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth";
  const res = await fetch(`${authUrl}/get-session`, { credentials: "include" });
  return { status: res.status, body: (await res.text()).slice(0, 200) };
});
console.log("get-session:", JSON.stringify(sessionState));

await browser.close();
