-- 20260628_fix_critical_rls.sql
-- Fix CRITICAL-06: Remove mahasiswa from qr_code SELECT policy
-- Students should never have direct access to raw QR tokens

-- Drop the existing overly-permissive policy
drop policy if exists qr_code_select on qr_code;

-- Recreate without mahasiswa role
create policy qr_code_select on qr_code for select
using (public.has_role(array['super_admin','admin_prodi','dosen']));
