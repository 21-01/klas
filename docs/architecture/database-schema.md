# Klas. Database Schema

This document outlines the authoritative database schema as defined in the `supabase/migrations/` directory.

---

## 1. Core Entities (`001_core.sql`)

### `users`
User profiles linked to Supabase Auth UID.
* **`user_id`**: UUID (PK) - Default `uuid_generate_v4()`
* **`email`**: VARCHAR(255) UNIQUE
* **`name`**: VARCHAR(150)
* **`role`**: VARCHAR(20) - Enum: `'mahasiswa'`, `'dosen'`, `'admin'`
* **`is_active`**: BOOLEAN (Default: `true`)
* **`created_at`** / **`updated_at`**: TIMESTAMPTZ

### `program_studi`
Study programs (e.g., Teknik Informatika).
* **`prodi_id`**: INT (PK, Generated Identity)
* **`kode_prodi`**: VARCHAR(20) UNIQUE
* **`nama_prodi`**: VARCHAR(150)
* **`created_at`**: TIMESTAMPTZ

### `mahasiswa`
Student profiles.
* **`mahasiswa_id`**: UUID (PK)
* **`user_id`**: UUID (UNIQUE FK -> `users.user_id`, CASCADE)
* **`nim`**: VARCHAR(30) UNIQUE
* **`nama`**: VARCHAR(150)
* **`prodi_id`**: INT (FK -> `program_studi.prodi_id`)
* **`angkatan`**: VARCHAR(4)
* **`jenis_kelamin`**: VARCHAR(1) - Enum: `'L'`, `'P'`
* **`gpa`**: DECIMAL(3,2)
* **`pembimbing_akademik`**: VARCHAR(150)
* **`is_active`**: BOOLEAN (Default: `true`)
* **`created_at`** / **`updated_at`**: TIMESTAMPTZ

### `dosen`
Lecturer profiles.
* **`dosen_id`**: UUID (PK)
* **`user_id`**: UUID (UNIQUE FK -> `users.user_id`, CASCADE)
* **`nip`**: VARCHAR(30) UNIQUE
* **`nidn`**: VARCHAR(30) UNIQUE
* **`nama`**: VARCHAR(150)
* **`prodi_id`**: INT (FK -> `program_studi.prodi_id`)
* **`jenis_kelamin`**: VARCHAR(1) - Enum: `'L'`, `'P'`
* **`is_active`**: BOOLEAN (Default: `true`)
* **`created_at`** / **`updated_at`**: TIMESTAMPTZ

---

## 2. Academic Structure (`002_academic.sql`)

### `mata_kuliah`
Courses.
* **`mk_id`**: UUID (PK)
* **`kode_mk`**: VARCHAR(20) UNIQUE
* **`nama_mk`**: VARCHAR(200)
* **`sks`**: INT (Between 1 and 6)
* **`prodi_id`**: INT (FK -> `program_studi.prodi_id`)
* **`is_active`**: BOOLEAN (Default: `true`)

### `ruangan`
Classrooms and geofences.
* **`ruangan_id`**: UUID (PK)
* **`kode_ruangan`**: VARCHAR(30) UNIQUE
* **`nama_ruangan`**: VARCHAR(150)
* **`kapasitas`**: INT
* **`latitude`**: DECIMAL(10,7)
* **`longitude`**: DECIMAL(10,7)
* **`geofence_radius_m`**: INT (Default: `50`)
* **`is_active`**: BOOLEAN

### `jadwal_kelas`
Class schedules linking courses, lecturers, and classrooms.
* **`jadwal_id`**: UUID (PK)
* **`mk_id`**: UUID (FK -> `mata_kuliah.mk_id`)
* **`dosen_id`**: UUID (FK -> `dosen.dosen_id`)
* **`ruangan_id`**: UUID (FK -> `ruangan.ruangan_id`)
* **`hari`**: ENUM (`'Senin'`, `'Selasa'`, `'Rabu'`, `'Kamis'`, `'Jumat'`, `'Sabtu'`)
* **`waktu_mulai`**: TIME
* **`waktu_selesai`**: TIME
* **`semester`**: VARCHAR(20)
* **`tahun_akademik`**: VARCHAR(9)
* **`status`**: ENUM (`'assigned'`, `'unassigned'`, `'room-missing'`) (Default: `'unassigned'`)
* **`quota`**: INT (Default: `0`)
* **`is_active`**: BOOLEAN

### `pendaftaran_kelas`
Enrollment mapping students to schedules.
* **`pendaftaran_id`**: UUID (PK)
* **`mahasiswa_id`**: UUID (FK -> `mahasiswa.mahasiswa_id`, CASCADE)
* **`jadwal_id`**: UUID (FK -> `jadwal_kelas.jadwal_id`, CASCADE)
* **`created_at`**: TIMESTAMPTZ
* **Constraints**: `UNIQUE (mahasiswa_id, jadwal_id)`

---

## 3. Attendance System (`003_attendance.sql`)

### `sesi_kehadiran`
Live attendance sessions opened by lecturers.
* **`sesi_id`**: UUID (PK)
* **`jadwal_id`**: UUID (FK -> `jadwal_kelas.jadwal_id`)
* **`tanggal`**: DATE (Default: `current_date`)
* **`waktu_mulai`** / **`waktu_selesai`**: TIMESTAMPTZ
* **`qr_seed`**: DOUBLE PRECISION
* **`qr_rotates_every`**: INT (Default: `15`)
* **`geofence_radius_m`**: INT (Default: `50`)
* **`status`**: ENUM (`'scheduled'`, `'live'`, `'completed'`, `'cancelled'`)
* **`dibuka_oleh`**: UUID (FK -> `dosen.dosen_id`)

### `presensi`
Individual student check-in records.
* **`presensi_id`**: UUID (PK)
* **`sesi_id`**: UUID (FK -> `sesi_kehadiran.sesi_id`)
* **`mahasiswa_id`**: UUID (FK -> `mahasiswa.mahasiswa_id`)
* **`waktu_check_in`**: TIMESTAMPTZ
* **`latitude`** / **`longitude`**: DECIMAL(10,7)
* **`ip_address`**: INET
* **`metode`**: ENUM (`'qr'`, `'manual'`) (Default: `'qr'`)
* **`status`**: ENUM (`'present'`, `'absent'`, `'excused'`, `'late'`) (Default: `'absent'`)
* **`geofence_delta_m`**: DECIMAL(10,2)
* **`geofence_flagged`**: BOOLEAN (Default: `false`)
* **Constraints**: `UNIQUE (sesi_id, mahasiswa_id)`

### `koreksi_presensi`
Manual attendance corrections/overrides.
* **`koreksi_id`**: UUID (PK)
* **`presensi_id`**: UUID (FK -> `presensi.presensi_id`, CASCADE)
* **`diubah_oleh`**: UUID (FK -> `dosen.dosen_id`)
* **`status_sebelum`**: ENUM (from `status_presensi_enum`)
* **`status_sesudah`**: ENUM (from `status_presensi_enum`)
* **`alasan`**: TEXT

### `qr_code`
Time-limited encrypted QR tokens.
* **`qr_id`**: UUID (PK)
* **`sesi_id`**: UUID (FK -> `sesi_kehadiran.sesi_id`)
* **`token`**: TEXT
* **`expired_at`**: TIMESTAMPTZ

---

## 4. Security, Config & Logging (`004_security.sql`)

### `audit_log`
Append-only audit trail.
* **`log_id`**: UUID (PK)
* **`user_id`**: UUID (FK -> `users.user_id`)
* **`timestamp`**: TIMESTAMPTZ
* **`kategori`**: ENUM (`'Master Data'`, `'Schedule Plotting'`, `'Security Policies'`, `'Attendance Overrides'`, `'Authentication'`, `'Geofence'`, `'System'`)
* **`aksi`**: TEXT
* **`ip_address`**: INET
* **`status`**: ENUM (`'success'`, `'failed'`)
* **`metadata`**: JSONB

### `notifikasi`
In-app notifications.
* **`notifikasi_id`**: UUID (PK)
* **`user_id`**: UUID (FK -> `users.user_id`)
* **`tipe`**: ENUM (`'geofence_flag'`, `'session_closed'`, `'new_account'`, `'scheduler_run'`, `'system'`, `'checkin_success'`, `'brute_force'`)
* **`judul`**: VARCHAR(200)
* **`pesan`**: TEXT
* **`is_read`**: BOOLEAN (Default: `false`)

### `role_permissions`
RBAC Permission matrix.
* **`role_permission_id`**: UUID (PK)
* **`role`**: ENUM (`'super_admin'`, `'admin_prodi'`, `'dosen'`, `'mahasiswa'`) UNIQUE
* **`can_read`**, **`can_write`**, **`can_moderate_attendance`**, **`can_configure_system`**, **`is_locked`**: BOOLEAN
* **`updated_by`**: UUID (FK -> `users.user_id`)

### `konfigurasi_sistem`
Key-value configuration store (e.g. `tfa_enabled`, `session_timeout_minutes`).
* **`config_id`**: UUID (PK)
* **`key`**: VARCHAR(100) UNIQUE
* **`value`**: JSONB
* **`updated_by`**: UUID (FK -> `users.user_id`)

### `ip_whitelist`
Campus network subnets.
* **`whitelist_id`**: UUID (PK)
* **`cidr`**: VARCHAR(45) UNIQUE
* **`label`**: VARCHAR(100)

### `failed_login_attempts`
Brute-force protection tracker.
* **`attempt_id`**: UUID (PK)
* **`ip_address`**: INET
* **`email`**: VARCHAR(255)
* **`attempted_at`**: TIMESTAMPTZ
