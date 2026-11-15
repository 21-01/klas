// Seeds the Neon branch with the demo dataset (adapted from supabase/seed.sql).
// Auth users are created separately by scripts/auth-users.mjs; this maps them by email.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i <= 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
}

const SQL = `
begin;

truncate table
  presensi, koreksi_presensi, qr_code, sesi_kehadiran,
  pendaftaran_kelas, jadwal_kelas, mata_kuliah, ruangan,
  mahasiswa, dosen, program_studi, audit_log, notifikasi,
  role_permissions, failed_login_attempts
restart identity cascade;

insert into program_studi (prodi_id, kode_prodi, nama_prodi) overriding system value values
  (1, 'IK', 'Ilmu Komputer');

insert into mata_kuliah (mk_id, kode_mk, nama_mk, sks, prodi_id) values
  ('d0000000-0000-0000-0000-000000000001', 'IK501', 'Rekayasa Perangkat Lunak', 3, 1),
  ('d0000000-0000-0000-0000-000000000002', 'IK502', 'Teori Informasi',          3, 1),
  ('d0000000-0000-0000-0000-000000000003', 'IK503', 'Sistem Operasi',           3, 1),
  ('d0000000-0000-0000-0000-000000000004', 'IK504', 'Pemrograman Deklaratif',   3, 1),
  ('d0000000-0000-0000-0000-000000000005', 'IK505', 'Organisasi Komputer',      3, 1);

insert into ruangan (ruangan_id, kode_ruangan, nama_ruangan, kapasitas, latitude, longitude, geofence_radius_m) values
  ('e0000000-0000-0000-0000-000000000001', 'GDS-506', 'Gedung Dewi Sartika 506', 40, -6.2022230, 106.8464190, 50),
  ('e0000000-0000-0000-0000-000000000002', 'GDS-507', 'Gedung Dewi Sartika 507', 40, -6.2022240, 106.8464200, 50),
  ('e0000000-0000-0000-0000-000000000003', 'GDS-508', 'Gedung Dewi Sartika 508', 40, -6.2022250, 106.8464210, 50),
  ('e0000000-0000-0000-0000-000000000004', 'GDS-509', 'Gedung Dewi Sartika 509', 40, -6.2022260, 106.8464220, 50),
  ('e0000000-0000-0000-0000-000000000005', 'GDS-510', 'Gedung Dewi Sartika 510', 40, -6.2022270, 106.8464230, 50),
  ('e0000000-0000-0000-0000-000000000006', 'GDS-511', 'Gedung Dewi Sartika 511', 40, -6.2022280, 106.8464240, 50),
  ('e0000000-0000-0000-0000-000000000007', 'GDS-512', 'Gedung Dewi Sartika 512', 40, -6.2022290, 106.8464250, 50),
  ('e0000000-0000-0000-0000-000000000008', 'GDS-513', 'Gedung Dewi Sartika 513', 40, -6.2022300, 106.8464260, 50),
  ('e0000000-0000-0000-0000-000000000009', 'GDS-514', 'Gedung Dewi Sartika 514', 40, -6.2022310, 106.8464270, 50),
  ('e0000000-0000-0000-0000-000000000010', 'GDS-515', 'Gedung Dewi Sartika 515', 40, -6.2022320, 106.8464280, 50);

insert into role_permissions (role, can_read, can_write, can_moderate_attendance, can_configure_system, is_locked) values
  ('super_admin', true, true, true, true,  true),
  ('admin_prodi', true, true, true, true,  false),
  ('dosen',       true, true, true, false, false),
  ('mahasiswa',   true, false,false,false, false)
on conflict (role) do nothing;

do $$
declare
  a_admin uuid; a_dosen1 uuid; a_dosen2 uuid; a_mhs1 uuid; a_mhs2 uuid; a_mhs3 uuid;
begin
  select user_id into a_admin  from users where email = 'admin@klas.unj.ac.id';
  select user_id into a_dosen1 from users where email = 'budi.santoso@unj.ac.id';
  select user_id into a_dosen2 from users where email = 'siti.rahma@unj.ac.id';
  select user_id into a_mhs1   from users where email = 'ahmad.fauzi@mhs.unj.ac.id';
  select user_id into a_mhs2   from users where email = 'dewi.lestari@mhs.unj.ac.id';
  select user_id into a_mhs3   from users where email = 'rizki.pratama@mhs.unj.ac.id';

  if a_admin is null or a_dosen1 is null or a_dosen2 is null or a_mhs1 is null or a_mhs2 is null or a_mhs3 is null then
    raise exception 'demo auth users missing: run scripts/auth-users.mjs first';
  end if;

  insert into dosen (dosen_id, user_id, nip, nidn, nama, prodi_id, jenis_kelamin) values
    ('b0000000-0000-0000-0000-000000000001', a_dosen1,
     '199003152024061001', '0028039001', 'Budi Santoso', 1, 'L'),
    ('b0000000-0000-0000-0000-000000000002', a_dosen2,
     '199211202025061002', '0045112002', 'Siti Rahma',   1, 'P');

  insert into mahasiswa (mahasiswa_id, user_id, nim, nama, prodi_id, angkatan, jenis_kelamin, gpa, pembimbing_akademik) values
    ('c0000000-0000-0000-0000-000000000001', a_mhs1, '1202410001', 'Ahmad Fauzi',   1, '2024', 'L', 3.80, 'Budi Santoso'),
    ('c0000000-0000-0000-0000-000000000002', a_mhs2, '1202410002', 'Dewi Lestari',  1, '2024', 'P', 3.90, 'Siti Rahma'),
    ('c0000000-0000-0000-0000-000000000003', a_mhs3, '1202410003', 'Rizki Pratama', 1, '2024', 'L', 3.65, 'Budi Santoso');

  insert into jadwal_kelas (jadwal_id, mk_id, dosen_id, ruangan_id, hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, status, quota) values
    ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Senin',  '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
    ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'Selasa', '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
    ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Rabu',   '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
    ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 'Kamis',  '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
    ('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'Jumat',  '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40);

  insert into pendaftaran_kelas (mahasiswa_id, jadwal_id)
  select m.mahasiswa_id, j.jadwal_id
  from mahasiswa m cross join jadwal_kelas j
  where m.mahasiswa_id in (
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003');
end $$;

commit;
`;

const client = new Client({
  connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(SQL);
  const counts = await client.query(`
    select 'users' t, count(*)::int n from users
    union all select 'mahasiswa', count(*)::int from mahasiswa
    union all select 'dosen', count(*)::int from dosen
    union all select 'jadwal_kelas', count(*)::int from jadwal_kelas
    union all select 'pendaftaran_kelas', count(*)::int from pendaftaran_kelas`);
  console.table(counts.rows);
} finally {
  await client.end();
}
