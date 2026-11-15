// Wipes ALL KLAS data (app tables + Neon Auth users) for a fresh demo seed.
// Usage: node --env-file=.env.local scripts/reset-demo.mjs
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  console.log("counts before:");
  const before = await client.query(`
    select 'users' t, count(*)::int n from users
    union all select 'mahasiswa', count(*)::int from mahasiswa
    union all select 'dosen', count(*)::int from dosen
    union all select 'auth_users', count(*)::int from neon_auth."user"`);
  console.table(before.rows);

  // App tables (children first via cascade anyway, but be explicit)
  await client.query(`
    truncate table
      presensi, koreksi_presensi, qr_code, sesi_kehadiran,
      pendaftaran_kelas, jadwal_kelas, mata_kuliah, ruangan,
      mahasiswa, dosen, program_studi, audit_log, notifikasi,
      role_permissions, failed_login_attempts
    restart identity cascade`);
  console.log("app tables truncated");

  // Auth domain: sessions, accounts, users (delete — neon_auth tables deny TRUNCATE for our role)
  await client.query(`delete from neon_auth.session`);
  await client.query(`delete from neon_auth.account`);
  await client.query(`delete from neon_auth.verification`);
  await client.query(`delete from neon_auth."user"`);
  console.log("neon_auth cleared");

  const after = await client.query(`
    select 'users' t, count(*)::int n from users
    union all select 'auth_users', count(*)::int from neon_auth."user"`);
  console.table(after.rows);
} finally {
  await client.end();
}
