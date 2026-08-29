-- Fix HIGH-12: Restrict users and presensi SELECT policies
-- Students should only see their own records, not everyone's

-- === USERS TABLE ===
DROP POLICY IF EXISTS users_select ON users;

-- Admin/super_admin: see all users
CREATE POLICY users_select_admin ON users FOR SELECT
USING (public.has_role(array['super_admin', 'admin_prodi']));

-- Dosen: see all users (needed for student lookups in their classes)
CREATE POLICY users_select_dosen ON users FOR SELECT
USING (public.has_role(array['dosen']));

-- Mahasiswa: see only own record
CREATE POLICY users_select_mahasiswa ON users FOR SELECT
USING (
  public.has_role(array['mahasiswa'])
  AND user_id = auth.uid()
);

-- === PRESENSI TABLE ===
DROP POLICY IF EXISTS presensi_select ON presensi;

-- Admin/super_admin: see all attendance
CREATE POLICY presensi_select_admin ON presensi FOR SELECT
USING (public.has_role(array['super_admin', 'admin_prodi']));

-- Dosen: see attendance for sessions in their classes
CREATE POLICY presensi_select_dosen ON presensi FOR SELECT
USING (
  public.has_role(array['dosen'])
  AND sesi_id IN (
    SELECT sk.sesi_id FROM sesi_kehadiran sk
    JOIN jadwal_kelas jk ON jk.jadwal_id = sk.jadwal_id
    WHERE jk.dosen_id IN (
      SELECT d.dosen_id FROM dosen d WHERE d.user_id = auth.uid()
    )
  )
);

-- Mahasiswa: see only own attendance
CREATE POLICY presensi_select_mahasiswa ON presensi FOR SELECT
USING (
  public.has_role(array['mahasiswa'])
  AND mahasiswa_id IN (
    SELECT m.mahasiswa_id FROM mahasiswa m WHERE m.user_id = auth.uid()
  )
);
