// Probes Neon Auth: sign-in shape, JWT availability, session endpoint.
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i <= 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
}
const B = env.NEON_AUTH_BASE_URL;
const Origin = "http://localhost:5173";

const r = await fetch(`${B}/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin },
  body: JSON.stringify({ email: "nandana.ammar@mhs.unj.ac.id", password: "KlasDemo#2026" }),
});
const text = await r.text();
let j;
try { j = JSON.parse(text); } catch { j = { raw: text }; }
console.log("sign-in status:", r.status);
console.log("keys:", Object.keys(j));
console.log("user.id:", j.user?.id);
console.log("token length:", String(j.token ?? "").length, "value:", String(j.token ?? "").slice(0, 40));
const cookie = r.headers.getSetCookie?.() ?? [];
console.log("set-cookie count:", cookie.length);
console.log("cookies:", cookie.map((c) => c.split(";")[0]).join(" | "));

const headers = { Origin, ...(cookie.length ? { cookie: cookie.map((c) => c.split(";")[0]).join("; ") } : {}) };
for (const ep of ["/token", "/get-session", "/.well-known/jwks.json"]) {
  try {
    const x = await fetch(`${B}${ep}`, { headers });
    const body = await x.text();
    console.log(`\n${ep} -> ${x.status}\n${body.slice(0, 400)}`);
  } catch (e) {
    console.log(`\n${ep} -> ERR ${e.message}`);
  }
}
