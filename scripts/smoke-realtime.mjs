// Proves Neon Realtime end to end: mint a sealed capability through the API,
// subscribe over WebSocket, and read live rows.
// Usage: node scripts/smoke-realtime.mjs
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i <= 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
}

const BASE = `https://${env.NEON_BRANCH_ID}-api${env.NEON_FUNCTION_HOST_SUFFIX}`.replace(/\/$/, "");
const AUTH = env.NEON_AUTH_BASE_URL;
const PASSWORD = "KlasDemo#2026";

async function token(email) {
  const res = await fetch(`${AUTH}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const t = await fetch(`${AUTH}/token`, { headers: { Origin: "http://localhost:5173", cookie } }).then((r) => r.json());
  return t.token;
}

async function post(path, body, jwt) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: text };
  }
}

const results = [];
function log(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const dosen = await token("samudra.adi@unj.ac.id");
const mahasiswa = await token("nandana.ammar@mhs.unj.ac.id");

const list = await post("/list-sessions", { jadwal_id: "f0000000-0000-0000-0000-000000000001", limit: 10 }, dosen);
const session = list.json?.sessions?.find((s) => s.status === "live") ?? list.json?.sessions?.[0];
if (!session) {
  log("find a live session", false, "no sessions; run scripts/smoke.mjs first");
  process.exit(1);
}
const sesi_id = session.sesi_id;
log("find a live session", true, sesi_id);

const config = await fetch(`${BASE}/realtime/config`).then((r) => r.json());
log("GET /realtime/config", typeof config.url === "string" && config.url.startsWith("ws"), config.url ? "wss URL present" : "missing");

const sealed = await post("/realtime/presensi", { sesi_id }, dosen);
const hasCapability = sealed.status === 200 && (sealed.json?.capability || sealed.json?.queryFingerprint);
log("POST /realtime/presensi (sealed capability)", Boolean(hasCapability), `${sealed.status} keys=${Object.keys(sealed.json ?? {}).join(",")}`);

// A student must not be able to seal the lecturer-only attendance feed.
const denied = await post("/realtime/presensi", { sesi_id }, mahasiswa);
log("POST /realtime/presensi as student → 403", denied.status === 403, `${denied.status}`);

if (!hasCapability) process.exit(1);

const noWs = process.argv.includes("--no-ws");
if (noWs) {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} realtime checks passed (websocket skipped)`);
  process.exit(passed === results.length ? 0 : 1);
}

const { createRealtimeClient } = await import("@neon/realtime/client");
const client = createRealtimeClient({ url: config.url });
const sub = client.subscribe(sealed.json);

const outcome = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve({ status: "timeout" }), 15_000);
  sub.onChange((snapshot) => {
    if (snapshot.status === "live" || snapshot.status === "error") {
      clearTimeout(timer);
      resolve({ status: snapshot.status, rows: snapshot.data, error: snapshot.error });
    }
  });
});

if (outcome.status === "live") {
  log("Realtime WebSocket subscription", true, `live, ${outcome.rows?.length ?? 0} row(s)`);
} else if (outcome.status === "timeout") {
  log("Realtime WebSocket subscription", false, "no live status within 15s");
} else {
  log("Realtime WebSocket subscription", false, `status=${outcome.status} ${outcome.error ?? ""}`);
}

sub.unsubscribe?.();
await client.close?.();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} realtime checks passed`);
process.exit(passed === results.length ? 0 : 1);
