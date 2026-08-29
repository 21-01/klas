-- 003_attendance.sql
-- Attendance tracking: sesi_kehadiran, presensi, koreksi_presensi, qr_code

-- ============================================================
-- SESI_KAHADIRAN (Live Attendance Sessions)
-- ============================================================
create type status_sesi_enum as enum ('scheduled', 'live', 'completed', 'cancelled');

create table if not exists sesi_kehadiran (
  sesi_id             uuid primary key default uuid_generate_v4(),
  jadwal_id           uuid not null references jadwal_kelas(jadwal_id),
  tanggal             date not null default current_date,
  waktu_mulai         timestamptz,
  waktu_selesai       timestamptz,
  qr_seed             double precision,
  qr_rotates_every    int not null default 15,
  geofence_radius_m   int not null default 50,
  status              status_sesi_enum not null default 'scheduled',
  dibuka_oleh         uuid references dosen(dosen_id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table sesi_kehadiran is 'Live attendance sessions opened by lecturers';

-- ============================================================
-- PRESENSI (Attendance Records)
-- ============================================================
create type status_presensi_enum as enum ('present', 'absent', 'excused', 'late');
create type metode_presensi_enum as enum ('qr', 'manual');

create table if not exists presensi (
  presensi_id         uuid primary key default uuid_generate_v4(),
  sesi_id             uuid not null references sesi_kehadiran(sesi_id),
  mahasiswa_id        uuid not null references mahasiswa(mahasiswa_id),
  waktu_check_in      timestamptz,
  latitude            decimal(10,7),
  longitude           decimal(10,7),
  ip_address          inet,
  metode              metode_presensi_enum not null default 'qr',
  status              status_presensi_enum not null default 'absent',
  geofence_delta_m    decimal(10,2),
  geofence_flagged    boolean not null default false,
  created_at          timestamptz not null default now(),

  unique (sesi_id, mahasiswa_id)
);

comment on table presensi is 'Individual student attendance check-in records';

-- ============================================================
-- KOREKSI_PRESENSI (Attendance Corrections / Overrides)
-- ============================================================
create table if not exists koreksi_presensi (
  koreksi_id      uuid primary key default uuid_generate_v4(),
  presensi_id     uuid not null references presensi(presensi_id) on delete cascade,
  diubah_oleh     uuid not null references dosen(dosen_id),
  status_sebelum  status_presensi_enum not null,
  status_sesudah  status_presensi_enum not null,
  alasan          text,
  created_at      timestamptz not null default now()
);

comment on table koreksi_presensi is 'Manual attendance corrections by lecturers';

-- ============================================================
-- QR_CODE (Dynamic QR Tokens)
-- ============================================================
create table if not exists qr_code (
  qr_id         uuid primary key default uuid_generate_v4(),
  sesi_id       uuid not null references sesi_kehadiran(sesi_id),
  token         text not null,
  expired_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

comment on table qr_code is 'Time-limited encrypted QR tokens for attendance check-in';

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_sesi_jadwal on sesi_kehadiran(jadwal_id);
create index if not exists idx_sesi_status on sesi_kehadiran(status);
create index if not exists idx_sesi_tanggal on sesi_kehadiran(tanggal);
create index if not exists idx_presensi_sesi on presensi(sesi_id);
create index if not exists idx_presensi_mahasiswa on presensi(mahasiswa_id);
create index if not exists idx_presensi_status on presensi(status);
create index if not exists idx_presensi_sesi_mhs on presensi(sesi_id, mahasiswa_id);
create index if not exists idx_koreksi_presensi on koreksi_presensi(presensi_id);
create index if not exists idx_qr_sesi on qr_code(sesi_id);
create index if not exists idx_qr_expired on qr_code(expired_at);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
create trigger set_updated_at_sesi_kehadiran
  before update on sesi_kehadiran for each row execute function trigger_set_updated_at();
