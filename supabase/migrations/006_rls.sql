create or replace function public.user_role()
returns text
language sql stable
as $$
  select role from public.users where user_id = auth.uid();
$$;

create or replace function public.is_role(required_role text)
returns boolean
language sql stable
as $$
  select public.user_role() = required_role;
$$;

create or replace function public.has_role(required_roles text[])
returns boolean
language sql stable
as $$
  select public.user_role() = any(required_roles);
$$;

-- === PROGRAM STUDI ===
alter table program_studi enable row level security;
create policy program_studi_select on program_studi for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy program_studi_insert on program_studi for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy program_studi_update on program_studi for update using (public.has_role(array['super_admin','admin_prodi']));
create policy program_studi_delete on program_studi for delete using (public.has_role(array['super_admin']));

-- === USERS ===
alter table users enable row level security;
create policy users_select on users for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy users_insert on users for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy users_update on users for update using (auth.uid() = user_id or public.has_role(array['super_admin']));
create policy users_delete on users for delete using (public.has_role(array['super_admin']));

-- === DOSEN ===
alter table dosen enable row level security;
create policy dosen_select on dosen for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy dosen_insert on dosen for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy dosen_update on dosen for update using (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy dosen_delete on dosen for delete using (public.has_role(array['super_admin']));

-- === MAHASISWA ===
alter table mahasiswa enable row level security;
create policy mahasiswa_select on mahasiswa for select using (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy mahasiswa_insert on mahasiswa for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy mahasiswa_update on mahasiswa for update using (auth.uid() = user_id or public.has_role(array['super_admin','admin_prodi']));
create policy mahasiswa_delete on mahasiswa for delete using (public.has_role(array['super_admin']));

-- === MATA KULIAH ===
alter table mata_kuliah enable row level security;
create policy mata_kuliah_select on mata_kuliah for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy mata_kuliah_insert on mata_kuliah for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy mata_kuliah_update on mata_kuliah for update using (public.has_role(array['super_admin','admin_prodi']));
create policy mata_kuliah_delete on mata_kuliah for delete using (public.has_role(array['super_admin']));

-- === RUANGAN ===
alter table ruangan enable row level security;
create policy ruangan_select on ruangan for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy ruangan_insert on ruangan for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy ruangan_update on ruangan for update using (public.has_role(array['super_admin','admin_prodi']));
create policy ruangan_delete on ruangan for delete using (public.has_role(array['super_admin']));

-- === JADWAL KELAS ===
alter table jadwal_kelas enable row level security;
create policy jadwal_kelas_select on jadwal_kelas for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy jadwal_kelas_insert on jadwal_kelas for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy jadwal_kelas_update on jadwal_kelas for update using (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy jadwal_kelas_delete on jadwal_kelas for delete using (public.has_role(array['super_admin']));

-- === PENDAFTARAN KELAS ===
alter table pendaftaran_kelas enable row level security;
create policy pendaftaran_kelas_select on pendaftaran_kelas for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy pendaftaran_kelas_insert on pendaftaran_kelas for insert with check (public.has_role(array['super_admin','admin_prodi']));
create policy pendaftaran_kelas_update on pendaftaran_kelas for update using (public.has_role(array['super_admin','admin_prodi']));
create policy pendaftaran_kelas_delete on pendaftaran_kelas for delete using (public.has_role(array['super_admin']));

-- === SESI KEHADIRAN ===
alter table sesi_kehadiran enable row level security;
create policy sesi_kehadiran_select on sesi_kehadiran for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy sesi_kehadiran_insert on sesi_kehadiran for insert with check (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy sesi_kehadiran_update on sesi_kehadiran for update using (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy sesi_kehadiran_delete on sesi_kehadiran for delete using (public.has_role(array['super_admin']));

-- === PRESENSI ===
alter table presensi enable row level security;
create policy presensi_select on presensi for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy presensi_insert on presensi for insert with check (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy presensi_update on presensi for update using (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy presensi_delete on presensi for delete using (public.has_role(array['super_admin']));

-- === KOREKSI PRESENSI ===
alter table koreksi_presensi enable row level security;
create policy koreksi_presensi_select on koreksi_presensi for select using (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy koreksi_presensi_insert on koreksi_presensi for insert with check (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy koreksi_presensi_update on koreksi_presensi for update using (public.has_role(array['super_admin','admin_prodi']));
create policy koreksi_presensi_delete on koreksi_presensi for delete using (public.has_role(array['super_admin']));

-- === QR CODE ===
alter table qr_code enable row level security;
create policy qr_code_select on qr_code for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy qr_code_insert on qr_code for insert with check (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy qr_code_update on qr_code for update using (public.has_role(array['super_admin','admin_prodi']));
create policy qr_code_delete on qr_code for delete using (public.has_role(array['super_admin']));

-- === AUDIT LOG ===
alter table audit_log enable row level security;
create policy audit_log_select on audit_log for select using (public.has_role(array['super_admin','admin_prodi']));
create policy audit_log_insert on audit_log for insert with check (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy audit_log_update on audit_log for update using (public.has_role(array['super_admin']));
create policy audit_log_delete on audit_log for delete using (public.has_role(array['super_admin']));

-- === NOTIFIKASI ===
alter table notifikasi enable row level security;
create policy notifikasi_select on notifikasi for select using (auth.uid() = user_id or public.has_role(array['super_admin']));
create policy notifikasi_insert on notifikasi for insert with check (public.has_role(array['super_admin','admin_prodi','dosen']));
create policy notifikasi_update on notifikasi for update using (auth.uid() = user_id or public.has_role(array['super_admin']));
create policy notifikasi_delete on notifikasi for delete using (public.has_role(array['super_admin']));

-- === ROLE PERMISSIONS ===
alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select using (public.has_role(array['super_admin','admin_prodi','dosen','mahasiswa']));
create policy role_permissions_insert on role_permissions for insert with check (public.has_role(array['super_admin']));
create policy role_permissions_update on role_permissions for update using (public.has_role(array['super_admin']));
create policy role_permissions_delete on role_permissions for delete using (public.has_role(array['super_admin']));

-- === KONFIGURASI SISTEM ===
alter table konfigurasi_sistem enable row level security;
create policy konfigurasi_sistem_select on konfigurasi_sistem for select using (public.has_role(array['super_admin','admin_prodi']));
create policy konfigurasi_sistem_insert on konfigurasi_sistem for insert with check (public.has_role(array['super_admin']));
create policy konfigurasi_sistem_update on konfigurasi_sistem for update using (public.has_role(array['super_admin']));
create policy konfigurasi_sistem_delete on konfigurasi_sistem for delete using (public.has_role(array['super_admin']));

-- === IP WHITELIST ===
alter table ip_whitelist enable row level security;
create policy ip_whitelist_select on ip_whitelist for select using (public.has_role(array['super_admin']));
create policy ip_whitelist_insert on ip_whitelist for insert with check (public.has_role(array['super_admin']));
create policy ip_whitelist_update on ip_whitelist for update using (public.has_role(array['super_admin']));
create policy ip_whitelist_delete on ip_whitelist for delete using (public.has_role(array['super_admin']));

-- === FAILED LOGIN ATTEMPTS ===
alter table failed_login_attempts enable row level security;
create policy failed_login_attempts_select on failed_login_attempts for select using (public.has_role(array['super_admin']));
create policy failed_login_attempts_insert on failed_login_attempts for insert with check (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy failed_login_attempts_update on failed_login_attempts for update using (public.has_role(array['super_admin']));
create policy failed_login_attempts_delete on failed_login_attempts for delete using (public.has_role(array['super_admin']));
