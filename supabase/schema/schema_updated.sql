-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS public.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL CHECK (role IN ('mahasiswa', 'dosen', 'admin'))
);

-- 2. ADMIN
CREATE TABLE IF NOT EXISTS public.admin (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- 3. DOSEN
CREATE TABLE IF NOT EXISTS public.dosen (
    dosen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- 4. MAHASISWA
CREATE TABLE IF NOT EXISTS public.mahasiswa (
    mahasiswa_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nim TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- 5. MATA_KULIAH
CREATE TABLE IF NOT EXISTS public.mata_kuliah (
    matkul_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_matkul TEXT NOT NULL,
    sks INTEGER NOT NULL CHECK (sks > 0)
);

-- 6. KELAS
CREATE TABLE IF NOT EXISTS public.kelas (
    kelas_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kelas TEXT NOT NULL,
    matkul_id UUID NOT NULL REFERENCES public.mata_kuliah(matkul_id) ON DELETE CASCADE,
    dosen_id UUID NOT NULL REFERENCES public.dosen(dosen_id) ON DELETE CASCADE
);

-- 7. RUANG_KELAS
CREATE TABLE IF NOT EXISTS public.ruang_kelas (
    ruang_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_ruang TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION NOT NULL DEFAULT 50.0 CHECK (radius > 0)
);

-- 8. JADWAL
CREATE TABLE IF NOT EXISTS public.jadwal (
    jadwal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES public.kelas(kelas_id) ON DELETE CASCADE,
    ruang_id UUID REFERENCES public.ruang_kelas(ruang_id) ON DELETE SET NULL,
    hari DATE NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    CONSTRAINT chk_times CHECK (jam_mulai < jam_selesai)
);

-- 9. SESI_KELAS
CREATE TABLE IF NOT EXISTS public.sesi_kelas (
    sesi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jadwal_id UUID NOT NULL REFERENCES public.jadwal(jadwal_id) ON DELETE CASCADE,
    waktu_mulai TIMESTAMPTZ NOT NULL,
    waktu_selesai TIMESTAMPTZ NOT NULL,
    status_aktif TEXT NOT NULL DEFAULT 'NONAKTIF',
    CONSTRAINT chk_session_times CHECK (waktu_mulai < waktu_selesai)
);

-- 10. PRESENSI
CREATE TABLE IF NOT EXISTS public.presensi (
    presensi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mahasiswa_id UUID NOT NULL REFERENCES public.mahasiswa(mahasiswa_id) ON DELETE CASCADE,
    sesi_id UUID NOT NULL REFERENCES public.sesi_kelas(sesi_id) ON DELETE CASCADE,
    waktu_checkin TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpa')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    ip_address TEXT
);

-- 11. QR_CODE
CREATE TABLE IF NOT EXISTS public.qr_code (
    qr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id UUID NOT NULL REFERENCES public.sesi_kelas(sesi_id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expired_at TIMESTAMPTZ NOT NULL
);

-- 12. PARAMETER_KEAMANAN
CREATE TABLE IF NOT EXISTS public.parameter_keamanan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radius_geofencing DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    toleransi_keterlambatan INTEGER NOT NULL DEFAULT 15,
    whitelist_ip TEXT,
    key TEXT UNIQUE,
    value TEXT
);

-- 13. FAILED_LOGIN_ATTEMPTS
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    email TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_aktor UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    peran TEXT,
    jenis_aktivitas TEXT,
    deskripsi_perubahan TEXT,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_klien TEXT,
    event_type TEXT,
    ip_address TEXT,
    user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    details TEXT,
    status TEXT
);

-- 15. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_penerima UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    tipe_notifikasi TEXT,
    stempel_waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    details TEXT,
    priority TEXT,
    type TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recipient_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- 16. NOTIFIKASI COMPATIBILITY VIEW
CREATE OR REPLACE VIEW public.notifikasi AS
SELECT 
    id,
    id_penerima,
    tipe_notifikasi,
    stempel_waktu,
    is_read,
    details,
    priority,
    type,
    timestamp,
    recipient_id
FROM public.notifications;
