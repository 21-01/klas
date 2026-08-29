-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL CHECK (role IN ('mahasiswa', 'dosen', 'admin'))
);

-- 2. ADMIN
CREATE TABLE IF NOT EXISTS admin (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. DOSEN
CREATE TABLE IF NOT EXISTS dosen (
    dosen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. MAHASISWA
CREATE TABLE IF NOT EXISTS mahasiswa (
    mahasiswa_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nim TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. MATA_KULIAH
CREATE TABLE IF NOT EXISTS mata_kuliah (
    matkul_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_matkul TEXT NOT NULL,
    sks INTEGER NOT NULL CHECK (sks > 0)
);

-- 6. KELAS
CREATE TABLE IF NOT EXISTS kelas (
    kelas_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kelas TEXT NOT NULL,
    matkul_id UUID NOT NULL REFERENCES mata_kuliah(matkul_id) ON DELETE CASCADE,
    dosen_id UUID NOT NULL REFERENCES dosen(dosen_id) ON DELETE CASCADE
);

-- 7. JADWAL
CREATE TABLE IF NOT EXISTS jadwal (
    jadwal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas_id UUID NOT NULL REFERENCES kelas(kelas_id) ON DELETE CASCADE,
    hari DATE NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    CONSTRAINT chk_times CHECK (jam_mulai < jam_selesai)
);

-- 8. SESI_KELAS
CREATE TABLE IF NOT EXISTS sesi_kelas (
    sesi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jadwal_id UUID NOT NULL REFERENCES jadwal(jadwal_id) ON DELETE CASCADE,
    waktu_mulai TIMESTAMPTZ NOT NULL,
    waktu_selesai TIMESTAMPTZ NOT NULL,
    status_aktif BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_session_times CHECK (waktu_mulai < waktu_selesai)
);

-- 9. PRESENSI
CREATE TABLE IF NOT EXISTS presensi (
    presensi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mahasiswa_id UUID NOT NULL REFERENCES mahasiswa(mahasiswa_id) ON DELETE CASCADE,
    sesi_id UUID NOT NULL REFERENCES sesi_kelas(sesi_id) ON DELETE CASCADE,
    waktu_checkin TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpa')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    ip_address TEXT
);

-- 10. QR_CODE
CREATE TABLE IF NOT EXISTS qr_code (
    qr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id UUID NOT NULL REFERENCES sesi_kelas(sesi_id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expired_at TIMESTAMPTZ NOT NULL
);

-- 11. PARAMETER_KEAMANAN
CREATE TABLE IF NOT EXISTS parameter_keamanan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radius_geofencing DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    toleransi_keterlambatan INTEGER NOT NULL DEFAULT 15,
    whitelist_ip TEXT
);

-- 12. AUDIT_LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_aktor UUID REFERENCES users(user_id) ON DELETE SET NULL,
    peran TEXT,
    jenis_aktivitas TEXT,
    deskripsi_perubahan TEXT,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_klien TEXT
);

-- 13. NOTIFIKASI
CREATE TABLE IF NOT EXISTS notifikasi (
    notifikasi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_penerima UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tipe_notifikasi TEXT,
    stempel_waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE
);
