// End-to-end smoke test for the deployed Neon API.
// Usage: node scripts/smoke.mjs [--base https://...] [--only <name>]
import { readFileSync } from "node:fs";
import { Client } from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i <= 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
const BASE = (baseArg >= 0 ? args[baseArg + 1] : `https://${env.NEON_BRANCH_ID}-api${env.NEON_FUNCTION_HOST_SUFFIX}`).replace(/\/$/, "");
const onlyArg = args.indexOf("--only");
const ONLY = onlyArg >= 0 ? args[onlyArg + 1] : null;

const AUTH = env.NEON_AUTH_BASE_URL;
const PASSWORD = "KlasDemo#2026";
const results = [];

function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function signIn(email) {
  const res = await fetch(`${AUTH}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in ${email} -> ${res.status} ${await res.text()}`);
  const cookies = res.headers.getSetCookie?.() ?? [];
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  const tokenRes = await fetch(`${AUTH}/token`, { headers: { Origin: "http://localhost:5173", cookie } });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.token) throw new Error(`no JWT for ${email}: ${JSON.stringify(tokenJson)}`);
  return tokenJson.token;
}

async function call(token, fn, body) {
  const res = await fetch(`${BASE}/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

let sessionId = null;

const steps = {
  async health() {
    const res = await fetch(`${BASE}/health`);
    log("GET /health", res.ok, `${res.status}`);
  },

  async login() {
    const res = await call(null, "login", { email: "samudra.adi@unj.ac.id", password: PASSWORD });
    const ok = res.status === 200 && res.json?.session?.access_token && res.json?.user?.role === "dosen";
    log("POST /login (dosen)", ok, ok ? `user=${res.json.user.email} role=${res.json.user.role}` : `${res.status} ${JSON.stringify(res.json)}`);
  },

  async badLogin() {
    const res = await call(null, "login", { email: "samudra.adi@unj.ac.id", password: "wrong-password" });
    log("POST /login (wrong password → 401)", res.status === 401, `${res.status} ${res.json?.error ?? ""}`);
  },

  async noAuth() {
    const res = await call(null, "get-dosen-dashboard");
    log("POST /get-dosen-dashboard without token → 401", res.status === 401, `${res.status}`);
  },

  async dosenFlow(token) {
    const dash = await call(token, "get-dosen-dashboard");
    const courses = dash.json?.courses ?? [];
    log("POST /get-dosen-dashboard", dash.status === 200 && courses.length > 0, `${dash.status} courses=${courses.length}`);

    const jadwalId = courses[0]?.jadwal_id;
    if (!jadwalId) throw new Error("no course to open a session for");

    const open = await call(token, "open-session", { jadwal_id: jadwalId, qr_rotates_every: 15 });
    const alreadyLive = open.status === 409;
    if (!alreadyLive) {
      log("POST /open-session", open.status === 201, `${open.status} sesi=${open.json?.sesi_id}`);
      sessionId = open.json?.sesi_id;
    } else {
      const list = await call(token, "list-sessions", { jadwal_id: jadwalId, limit: 5 });
      sessionId = list.json?.sessions?.find((s) => s.status === "live")?.sesi_id ?? list.json?.sessions?.[0]?.sesi_id;
      log("POST /open-session (session already live, reusing)", Boolean(sessionId), `${sessionId}`);
    }
    if (!sessionId) throw new Error("no session id");

    const qr = await call(token, "generate-qr-token", { sesi_id: sessionId, ttl_seconds: 15, covers: 2 });
    const tokenValue = qr.json?.tokens?.[0]?.qr_token;
    log("POST /generate-qr-token", qr.status === 200 && Boolean(tokenValue), `${qr.status} tokens=${qr.json?.tokens?.length}`);

    const profile = await call(token, "get-my-profile");
    log("POST /get-my-profile (dosen)", profile.status === 200 && profile.json?.role === "dosen", `${profile.status} ${profile.json?.nama ?? profile.json?.error ?? ""}`);

    const report = await call(token, "get-dosen-report", { jadwal_id: jadwalId });
    log("POST /get-dosen-report", report.status === 200 && Array.isArray(report.json?.students), `${report.status} students=${report.json?.students?.length}`);

    const csv = await call(token, "export-report", { jadwal_id: jadwalId, format: "csv" });
    const isCsv = csv.status === 200 && typeof csv.json === "string" && csv.json.startsWith("NIM,Nama,");
    log("POST /export-report", isCsv, `${csv.status} disposition=${csv.headers.get("content-disposition") ?? "-"} bytes=${String(csv.json).length}`);

    const roster = await call(token, "get-course-students", { jadwal_id: jadwalId, limit: 10 });
    log("POST /get-course-students", roster.status === 200 && Array.isArray(roster.json?.students), `${roster.status} students=${roster.json?.students?.length}`);

    return { tokenValue, jadwalId };
  },

  async mahasiswaFlow(token, ctx) {
    const dash = await call(token, "get-my-dashboard");
    log("POST /get-my-dashboard", dash.status === 200 && Array.isArray(dash.json?.classes), `${dash.status} classes=${dash.json?.classes?.length}`);

    const logs = await call(token, "get-my-logs", { limit: 5 });
    log("POST /get-my-logs", logs.status === 200 && Array.isArray(logs.json?.logs), `${logs.status} logs=${logs.json?.logs?.length}`);

    const stats = await call(token, "get-attendance-stats");
    log("POST /get-attendance-stats", stats.status === 200 && typeof stats.json?.attendance_rate === "number", `${stats.status} rate=${stats.json?.attendance_rate}`);

    const profile = await call(token, "get-my-profile");
    log("POST /get-my-profile (mahasiswa)", profile.status === 200 && profile.json?.role === "mahasiswa", `${profile.status} ${profile.json?.nim ?? profile.json?.error ?? ""}`);

    if (!ctx.tokenValue) {
      log("POST /check-in (skipped: no QR token)", false, "dosen lane did not produce a token");
      return;
    }
    // Room GDS-506 coordinates from the seed.
    const checkin = await call(token, "check-in", { qr_token: ctx.tokenValue, latitude: -6.202223, longitude: 106.846419 });
    const okStatus = checkin.status === 200 || checkin.status === 409;
    log("POST /check-in", okStatus, `${checkin.status} ${checkin.json?.message ?? checkin.json?.error ?? ""}${checkin.json?.distance ? ` distance=${checkin.json.distance}` : ""}`);

    const live = await call(token, "get-live-session", { sesi_id: sessionId });
    log("POST /get-live-session (as student → 403)", live.status === 403, `${live.status} ${live.json?.error ?? ""}`);
  },

  async adminFlow(token) {
    const dash = await call(token, "get-admin-dashboard");
    log("POST /get-admin-dashboard", dash.status === 200 && typeof dash.json?.total_students === "number", `${dash.status} students=${dash.json?.total_students} rate=${dash.json?.overall_attendance_rate}`);

    const global = await call(token, "get-global-attendance", { limit: 5 });
    log("POST /get-global-attendance", global.status === 200 && Array.isArray(global.json?.sessions), `${global.status} sessions=${global.json?.sessions?.length}`);

    const courses = await call(token, "get-admin-attendance-courses");
    log("POST /get-admin-attendance-courses", courses.status === 200 && Array.isArray(courses.json?.courses), `${courses.status} courses=${courses.json?.courses?.length}`);

    const audit = await call(token, "get-audit-logs", { limit: 5 });
    log("POST /get-audit-logs", audit.status === 200 && Array.isArray(audit.json?.logs), `${audit.status} logs=${audit.json?.logs?.length}`);

    const crud = await call(token, "crud-peserta-dummy", {});
    log("POST /unknown endpoint → 404", crud.status === 404, `${crud.status}`);

    const listMhs = await call(token, "crud-mahasiswa", { action: "list", limit: 5 });
    log("POST /crud-mahasiswa list", listMhs.status === 200 && Array.isArray(listMhs.json?.mahasiswa), `${listMhs.status} rows=${listMhs.json?.mahasiswa?.length}`);

    const listProdi = await call(token, "crud-prodi", { action: "list" });
    log("POST /crud-prodi list", listProdi.status === 200 && Array.isArray(listProdi.json?.data), `${listProdi.status} rows=${listProdi.json?.data?.length}`);

    const listJadwal = await call(token, "crud-jadwal", { action: "list", limit: 5 });
    log("POST /crud-jadwal list", listJadwal.status === 200 && Array.isArray(listJadwal.json?.jadwal), `${listJadwal.status} rows=${listJadwal.json?.jadwal?.length}`);
  },

  async liveSession(token) {
    const live = await call(token, "get-live-session", { sesi_id: sessionId });
    log("POST /get-live-session (dosen)", live.status === 200 && typeof live.json?.counts?.present === "number", `${live.status} present=${live.json?.counts?.present} absent=${live.json?.counts?.absent} recent=${live.json?.recent_checkins?.length}`);
  },

  async realtime() {
    // Realtime is verified over WebSocket in scripts/smoke-realtime.mjs.
  },

  async storage() {
    const client = new Client({ connectionString: env.DATABASE_URL_UNPOOLED, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const r = await client.query("select count(*)::int as n from audit_log");
      log("Postgres (direct pg connection)", r.rows[0].n > 0, `audit_log rows=${r.rows[0].n}`);
    } finally {
      await client.end();
    }
  },
};

const ORDER = [
  "health",
  "login",
  "badLogin",
  "noAuth",
  "storage",
  "dosenFlow",
  "mahasiswaFlow",
  "adminFlow",
  "liveSession",
  "realtime",
];

console.log(`API base: ${BASE}\n`);
let ctx = {};
try {
  const dosen = await signIn("samudra.adi@unj.ac.id");
  const mahasiswa = await signIn("nandana.ammar@mhs.unj.ac.id");
  const admin = await signIn("admin@klas.unj.ac.id");
  log("Neon Auth sign-in (dosen/mahasiswa/admin)", true, "3 JWTs minted");

  for (const name of ORDER) {
    if (ONLY && name !== ONLY) continue;
    if (name === "dosenFlow") {
      ctx = { ...(await steps.dosenFlow(dosen)), ...ctx };
    } else if (name === "mahasiswaFlow") {
      await steps.mahasiswaFlow(mahasiswa, ctx);
    } else if (name === "adminFlow") {
      await steps.adminFlow(admin);
    } else if (name === "liveSession") {
      await steps.liveSession(dosen);
    } else {
      await steps[name]();
    }
  }
} catch (error) {
  log("harness", false, error.message);
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) process.exitCode = 1;
