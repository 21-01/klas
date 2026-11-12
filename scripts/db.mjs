// Small SQL runner for the Neon branch.
// Usage:
//   node scripts/db.mjs probe
//   node scripts/db.mjs file <path.sql> [--continue-on-error]
//   node scripts/db.mjs query "<sql>"
import { readFileSync } from "node:fs";
import { Client } from "pg";

function env() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
  }
  return out;
}

const e = env();
const client = new Client({
  connectionString: e.DATABASE_URL_UNPOOLED || e.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  await client.connect();
  try {
    if (cmd === "probe") {
      const q = async (label, sql) => {
        try {
          const r = await client.query(sql);
          console.log(`--- ${label} ---`);
          console.table(r.rows);
        } catch (err) {
          console.log(`--- ${label} ERROR: ${err.message}`);
        }
      };
      await q("version", "select version()");
      await q("schemas", "select schema_name from information_schema.schemata order by 1");
      await q("extensions available", "select name, default_version, installed_version from pg_available_extensions where name in ('postgis','uuid-ossp','pgcrypto','pg_cron') order by 1");
      await q("neon_auth tables", "select table_name from information_schema.tables where table_schema='neon_auth' order by 1");
      await q("neon_auth user columns", "select column_name, data_type from information_schema.columns where table_schema='neon_auth' and table_name='user' order by ordinal_position");
      await q("public tables", "select table_name from information_schema.tables where table_schema='public' order by 1");
    } else if (cmd === "file") {
      const sql = readFileSync(rest[0], "utf8");
      await client.query(sql);
      console.log(`OK: ${rest[0]}`);
    } else if (cmd === "query") {
      const r = await client.query(rest.join(" "));
      console.log(JSON.stringify(r.rows, null, 2));
    } else {
      console.error("unknown command");
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  if (err.position) console.error("position", err.position);
  if (err.detail) console.error("detail", err.detail);
  process.exitCode = 1;
});
