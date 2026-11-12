// Creates demo users through Neon Auth (Managed Better Auth) and maps them into public.users.
// Usage: node scripts/auth-users.mjs [--probe]
import { readFileSync } from "node:fs";
import { Client } from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i <= 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
}

const BASE = env.NEON_AUTH_BASE_URL;
const DEMO_PASSWORD = "KlasDemo#2026";

const users = [
  { email: "admin@klas.unj.ac.id", name: "Admin", role: "admin" },
  { email: "samudra.adi@unj.ac.id", name: "Samudra Adi Guna", role: "dosen" },
  { email: "nandana.ammar@mhs.unj.ac.id", name: "Nandana Ammar Triabimanyu", role: "mahasiswa" },
  { email: "nadine.alysha@mhs.unj.ac.id", name: "Nadine Alysha Maheswari", role: "mahasiswa" },
  { email: "fathya.khairani@mhs.unj.ac.id", name: "Fathya Khairani R", role: "mahasiswa" },
];

async function signUp(u) {
  const res = await fetch(`${BASE}/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: u.email, password: DEMO_PASSWORD, name: u.name }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function signIn(u) {
  const res = await fetch(`${BASE}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: u.email, password: DEMO_PASSWORD }),
  });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch { return { status: res.status, json: { raw: text } }; }
}

async function main() {
  if (process.argv.includes("--probe")) {
    const r = await signUp({ email: "probe@klas.test", name: "Probe" });
    console.log(JSON.stringify(r, null, 2).slice(0, 2000));
    return;
  }

  const client = new Client({ connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const u of users) {
      let id;
      const up = await signUp(u);
      if (up.status >= 200 && up.status < 300 && up.json?.user?.id) {
        id = up.json.user.id;
        console.log(`created  ${u.email} -> ${id}`);
      } else {
        const si = await signIn(u);
        id = si.json?.user?.id;
        console.log(`exists?  ${u.email} sign-up=${up.status} sign-in=${si.status} -> ${id ?? "NO ID"} ${id ? "" : JSON.stringify(up.json).slice(0, 300)}`);
        if (!id) continue;
      }
      await client.query(
        `insert into users (user_id, email, name, role) values ($1,$2,$3,$4)
         on conflict (user_id) do update set email=excluded.email, name=excluded.name, role=excluded.role`,
        [id, u.email, u.name, u.role],
      );
    }
    const r = await client.query("select user_id, email, role from users order by email");
    console.table(r.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
