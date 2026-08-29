-- 1. Restoring ruang_kelas table
CREATE TABLE IF NOT EXISTS public.ruang_kelas (
    ruang_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_ruang TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION NOT NULL DEFAULT 50.0 CHECK (radius > 0)
);

-- 2. Restoring ruang_id column to public.jadwal
ALTER TABLE public.jadwal ADD COLUMN IF NOT EXISTS ruang_id UUID REFERENCES public.ruang_kelas(ruang_id) ON DELETE SET NULL;

-- 3. Adjusting sesi_kelas.status_aktif column from BOOLEAN to TEXT to support Edge Function string comparisons
ALTER TABLE public.sesi_kelas ALTER COLUMN status_aktif TYPE TEXT USING (CASE WHEN status_aktif THEN 'AKTIF' ELSE 'NONAKTIF' END);
ALTER TABLE public.sesi_kelas ALTER COLUMN status_aktif SET DEFAULT 'NONAKTIF';

-- 4. Restoring failed_login_attempts table
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    email TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Restoring audit_logs compatibility fields for Edge Functions
ALTER TABLE public.audit_logs 
    ADD COLUMN IF NOT EXISTS event_type TEXT,
    ADD COLUMN IF NOT EXISTS ip_address TEXT,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS details TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT;

-- 6. Restoring notifications table and notifikasi compatibility view
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

-- Ensure notifikasi view points to notifications
DROP TABLE IF EXISTS public.notifikasi CASCADE;
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

-- 7. Add key-value compatibility columns to parameter_keamanan
ALTER TABLE public.parameter_keamanan 
    ADD COLUMN IF NOT EXISTS key TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS value TEXT;
