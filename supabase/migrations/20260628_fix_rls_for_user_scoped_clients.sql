-- Fix HIGH-05: Enable user-scoped clients for user-facing edge functions
-- Most tables already have permissive SELECT policies that work with user-scoped clients.
-- The only missing policy is presensi INSERT for mahasiswa (needed for check-in).

-- === PRESENSI: Add mahasiswa INSERT policy ===
-- Mahasiswa can insert their own attendance record (check-in)
CREATE POLICY presensi_insert_mahasiswa ON presensi FOR INSERT
WITH CHECK (
  public.has_role(array['mahasiswa'])
  AND mahasiswa_id IN (
    SELECT m.mahasiswa_id FROM mahasiswa m WHERE m.user_id = auth.uid()
  )
);

-- Note: get-my-profile, get-my-dashboard, get-my-logs, get-attendance-stats,
-- get-dosen-profile, get-dosen-dashboard, list-sessions, generate-qr-token
-- all use SELECT on tables that already have permissive policies for all roles.
-- change-password stays on getAdminClient (auth.admin requires service role).
