-- seed.sql
-- Re-runnable seed for local development (run via supabase db reset).
-- Auth users must exist first (created via admin API or helper script).
-- Non-auth-dependent data is always inserted; auth-dependent data
-- is inserted only when matching auth.users email records exist.

begin;

-- ── Clean slate ──────────────────────────────────────────
truncate table
  pendaftaran_kelas,
  jadwal_kelas,
  sesi_kehadiran,
  presensi,
  koreksi_presensi,
  qr_code,
  mata_kuliah,
  ruangan,
  mahasiswa,
  dosen,
  users,
  program_studi,
  audit_log,
  notifikasi,
  role_permissions,
  konfigurasi_sistem,
  ip_whitelist,
  failed_login_attempts
restart identity cascade;

-- ── PROGRAM STUDI ────────────────────────────────────────
insert into program_studi (prodi_id, kode_prodi, nama_prodi) overriding system value values
  (1, 'IK', 'Ilmu Komputer');

-- ── MATA KULIAH ──────────────────────────────────────────
insert into mata_kuliah (mk_id, kode_mk, nama_mk, sks, prodi_id) values
  ('d0000000-0000-0000-0000-000000000001', 'IK501', 'Rekayasa Perangkat Lunak',   3, 1),
  ('d0000000-0000-0000-0000-000000000002', 'IK502', 'Teori Informasi',            3, 1),
  ('d0000000-0000-0000-0000-000000000003', 'IK503', 'Sistem Operasi',             3, 1),
  ('d0000000-0000-0000-0000-000000000004', 'IK504', 'Pemrograman Deklaratif',     3, 1),
  ('d0000000-0000-0000-0000-000000000005', 'IK505', 'Organisasi Komputer',        3, 1);

-- ── RUANGAN ──────────────────────────────────────────────
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

-- ── ROLE PERMISSIONS ─────────────────────────────────────
insert into role_permissions (role, can_read, can_write, can_moderate_attendance, can_configure_system, is_locked) values
  ('super_admin',    true, true, true, true,  true),
  ('admin_prodi',    true, true, true, true,  false),
  ('dosen',          true, true, true, false, false),
  ('mahasiswa',      true, false, false, false, false);

-- ── KONFIGURASI SISTEM ───────────────────────────────────
insert into konfigurasi_sistem (key, value) values
  ('tfa_enabled', 'true'::jsonb),
  ('session_timeout_minutes', '30'::jsonb),
  ('min_password_length', '12'::jsonb),
  ('require_special_char', 'true'::jsonb),
  ('strict_geofence', 'true'::jsonb),
  ('qr_ttl_seconds', '15'::jsonb);

-- ── IP WHITELIST ─────────────────────────────────────────
insert into ip_whitelist (cidr, label) values
  ('127.0.0.1/32', 'Localhost'),
  ('192.168.0.0/16', 'Private LAN'),
  ('10.0.0.0/8', 'Private LAN'),
  ('172.16.0.0/12', 'Private LAN');

-- ── Auth-dependent data ──────────────────────────────────
do $$
declare
  a_admin    uuid; a_dosen    uuid;
  a_nandana  uuid; a_nadine   uuid; a_fathya uuid;
begin
  select id into a_admin   from auth.users where email = 'admin@klas.unj.ac.id';
  select id into a_dosen   from auth.users where email = 'samudra.adi@unj.ac.id';
  select id into a_nandana from auth.users where email = 'nandana.ammar@mhs.unj.ac.id';
  select id into a_nadine  from auth.users where email = 'nadine.alysha@mhs.unj.ac.id';
  select id into a_fathya  from auth.users where email = 'fathya.khairani@mhs.unj.ac.id';

  if a_admin is not null and a_dosen is not null
     and a_nandana is not null and a_nadine is not null and a_fathya is not null
  then
    insert into users (user_id, email, name, role) values
      (a_admin,   'admin@klas.unj.ac.id',               'Admin',                     'admin'),
      (a_dosen,   'samudra.adi@unj.ac.id',               'Samudra Adi Guna',         'dosen'),
      (a_nandana, 'nandana.ammar@mhs.unj.ac.id',         'Nandana Ammar Triabimanyu', 'mahasiswa'),
      (a_nadine,  'nadine.alysha@mhs.unj.ac.id',         'Nadine Alysha Maheswari',   'mahasiswa'),
      (a_fathya,  'fathya.khairani@mhs.unj.ac.id',       'Fathya Khairani R',        'mahasiswa');

    insert into dosen (dosen_id, user_id, nip, nidn, nama, prodi_id, jenis_kelamin) values
      ('b0000000-0000-0000-0000-000000000001', a_dosen,
       '199507312024061001', '0031079501', 'Samudra Adi Guna', 1, 'L');

    insert into mahasiswa (mahasiswa_id, user_id, nim, nama, prodi_id, angkatan, jenis_kelamin, gpa, pembimbing_akademik) values
      ('c0000000-0000-0000-0000-000000000001', a_nandana,
       '1202410001', 'Nandana Ammar Triabimanyu', 1, '2024', 'L', 3.85, 'Samudra Adi Guna'),
      ('c0000000-0000-0000-0000-000000000002', a_nadine,
       '1202410002', 'Nadine Alysha Maheswari', 1, '2024', 'P', 3.95, 'Samudra Adi Guna'),
      ('c0000000-0000-0000-0000-000000000003', a_fathya,
       '1202410003', 'Fathya Khairani R', 1, '2024', 'P', 3.70, 'Samudra Adi Guna');

    insert into jadwal_kelas (jadwal_id, mk_id, dosen_id, ruangan_id, hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, status, quota) values
      ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Senin',   '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
      ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Selasa',  '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
      ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Rabu',    '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
      ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'Kamis',   '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40),
      ('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'Jumat',   '08:00', '10:30', 'Ganjil 2025/2026', '2025/2026', 'assigned', 40);

    insert into pendaftaran_kelas (mahasiswa_id, jadwal_id) values
      ('c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001'),
      ('c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002'),
      ('c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003'),
      ('c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004'),
      ('c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005'),
      ('c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001'),
      ('c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002'),
      ('c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003'),
      ('c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000004'),
      ('c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005'),
      ('c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001'),
      ('c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002'),
      ('c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003'),
      ('c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004'),
      ('c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005');
  end if;
end $$;

commit;
