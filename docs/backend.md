# Klas. Backend Architecture Documentation

This document outlines the structure and design of the **Klas.** backend, which is built on top of [Supabase](https://supabase.com). It leverages PostgreSQL, Row Level Security (RLS), Edge Functions, and pg_cron for scheduled tasks.

## 1. Database Schema & Migrations
The database schema is defined in a series of sequential SQL migrations located in `supabase/migrations/`.

### `001_core.sql` (Core Entities)
* **`users`**: Base table for all users containing `user_id`, `email`, `name`, `role` (mahasiswa, dosen, admin), and `is_active`.
* **`program_studi`**: Academic study programs/majors with `kode_prodi` and `nama_prodi`.
* **`mahasiswa`**: Student profiles linked to `users`. Contains `nim`, `nama`, `prodi_id`, `angkatan`, `jenis_kelamin` (L/P), `gpa`, `pembimbing_akademik`, and `is_active`.
* **`dosen`**: Lecturer profiles linked to `users`. Contains `nip`, `nidn`, `nama`, `prodi_id`, `jenis_kelamin`, and `is_active`.

> **Note:** The `super_admin` role exists only in the `role_permissions` table (RBAC matrix), not in the `users.role` check constraint. All admin users use the `admin` role in the `users` table.

### `002_academic.sql` (Academic Structure)
* **`mata_kuliah`**: Courses with `kode_mk`, `nama_mk`, `sks`, and `prodi_id`.
* **`ruangan`**: Classrooms containing GPS coordinates (`latitude`, `longitude`), `geofence_radius_m` (default 50m), and `kapasitas`.
* **`jadwal_kelas`**: Class schedules linking courses, lecturers, and classrooms. Contains `hari` (Senin–Sabtu), `waktu_mulai`, `waktu_selesai`, `semester`, `tahun_akademik`, `status` (assigned/unassigned/room-missing), and `quota`.
* **`pendaftaran_kelas`**: Enrollment records mapping students to class schedules. Unique constraint on (`mahasiswa_id`, `jadwal_id`).

### `003_attendance.sql` (Attendance System)
* **`sesi_kehadiran`**: Live/closed attendance sessions opened by lecturers. Contains `tanggal`, `waktu_mulai`, `waktu_selesai`, `qr_seed`, `qr_rotates_every` (default 15s), `geofence_radius_m` (default 50m), `status` (scheduled/live/completed/cancelled), and `dibuka_oleh` (lecturer who opened).
* **`presensi`**: Individual student check-in records containing `status` (present/absent/excused/late), `metode` (qr/manual), `latitude`, `longitude`, `ip_address`, `geofence_delta_m`, and `geofence_flagged`.
* **`koreksi_presensi`**: Manual attendance corrections by lecturers. Tracks `status_sebelum`, `status_sesudah`, `diubah_oleh`, and `alasan`.
* **`qr_code`**: Secure, rotating QR tokens for live sessions. Contains encrypted `token` and `expired_at`.

### `004_security.sql` (Security & Logs)
* **`audit_log`**: System-wide audit trails. Contains `kategori` (Master Data/Schedule Plotting/Security Policies/Attendance Overrides/Authentication/Geofence/System), `aksi`, `ip_address`, `status` (success/failed), and `metadata` (jsonb).
* **`notifikasi`**: In-app notifications per user. Contains `tipe` (geofence_flag/session_closed/new_account/scheduler_run/system/checkin_success/brute_force), `judul`, `pesan`, and `is_read`.
* **`role_permissions`**: RBAC matrix with granular columns: `can_read`, `can_write`, `can_moderate_attendance`, `can_configure_system`, and `is_locked`.
* **`konfigurasi_sistem`**: Key-value store for global system settings. Default keys: `tfa_enabled`, `session_timeout_minutes`, `min_password_length`, `require_special_char`, `strict_geofence`, `qr_ttl_seconds`.
* **`ip_whitelist`**: Campus network CIDR subnets for IP filtering.
* **`failed_login_attempts`**: Brute-force protection tracking with `ip_address`, `email`, and `attempted_at`.

### `006_rls.sql` (Row Level Security)
Enforces security at the database tier via helper functions `user_role()`, `is_role()`, and `has_role()`. Policies use JWT `role` claim to control access:
* Students can see their own profiles, enrolled schedules, and attendance.
* Lecturers can see data for classes they teach and manage attendance sessions.
* Admins have elevated access based on role (admin_prodi can read/write most tables; super_admin in `role_permissions` controls RBAC).
* Audit logs and IP whitelist are restricted to admin roles.

### `007_realtime.sql` (Realtime & Triggers)
* Adds `presensi`, `sesi_kehadiran`, and `notifikasi` tables to the `supabase_realtime` publication for WebSocket subscriptions.
* Defines `notify_geofence_violation()` trigger to automatically create in-app notifications for lecturers if a student checks in outside the physical geofence boundary.
* Provides `realtime_channel()` helper function for consistent channel name generation.

### `008_scheduled_tasks.sql` (Background Jobs)
Utilizes the `pg_cron` extension for automated database tasks:
* **Auto-close Stale Sessions** (`*/5 * * * *`): Automatically closes live sessions past their scheduled end time (`tanggal + waktu_selesai < now()`), with audit logging.
* **Cleanup Expired QR Codes** (`*/30 * * * * *`): Deletes expired QR tokens from the `qr_code` table every 30 seconds.
* **Daily Attendance Digest** (`0 23 * * *`): Runs daily at 23:00 to notify students whose attendance drops below 75%, and sends aggregate alerts to admins.

---

## 2. Edge Functions (API)
All business logic, external API integrations, and secure operations are handled via Supabase Edge Functions in `supabase/functions/`. They are invoked from the frontend using `supabase.functions.invoke()`.

### Auth & User Management
* **`login`**: Authenticates users and returns JWTs.
* **`refresh-session`**: Handles JWT token rotation.
* **`change-password`**: Secure password update.
* **`provision-user`**: Admin tool to create new users and link them to respective profiles.

### Mahasiswa (Student) Operations
* **`get-my-dashboard`**: Fetches today's active classes and live sessions.
* **`get-my-profile`**: Fetches the student's academic profile.
* **`get-my-logs`**: Fetches paginated personal attendance history.
* **`get-attendance-stats`**: Aggregates attendance percentages across all enrolled courses.

### Check-in & Security
* **`check-in`**: Validates a scanned QR token, verifies GPS coordinates against the classroom geofence, checks IP address against campus whitelist, and records attendance.
* **`generate-qr-token`**: Generates a batch of cryptographically signed, short-lived tokens. Accepts `ttl_seconds` (rotation interval) and `covers` (batch coverage in minutes). Each batch covers 2 minutes by default, reducing edge function invocations by ~91.5% compared to single-token generation.

### Dosen (Lecturer) Operations
* **`get-dosen-dashboard`**: Fetches the lecturer's schedule and currently active sessions.
* **`get-dosen-profile`**: Fetches the lecturer's profile information.
* **`update-dosen-profile`**: Updates the lecturer's profile (name, gender). Syncs to Supabase Auth metadata.
* **`open-session`**: Initializes a live classroom session and generates the initial QR seed.
* **`close-session`**: Ends a live session.
* **`update-session-settings`**: Modifies the geofence radius or QR rotation interval for an active session.
* **`update-session`**: Updates session parameters (date, geofence radius, QR rotation) for a completed session.
* **`get-live-session`**: Real-time polling endpoint returning current session status, check-in counts, and recent activity logs.
* **`list-sessions`**: Returns paginated history of past sessions for a given schedule.
* **`delete-session`**: Deletes a session and its associated check-in records.
* **`reopen-session`**: Reopens a completed session with an optional reason.
* **`get-course-students`**: Lists all students enrolled in a specific class.
* **`get-dosen-report`**: Aggregates attendance statistics for a course.
* **`bulk-mark-present`**: Allows lecturers to manually mark multiple students as present.
* **`correct-attendance`**: Approves/logs manual corrections to individual attendance records.
* **`export-report`**: Generates CSV/JSON exports for class attendance.

### Admin Operations
* **CRUD Endpoints**: Separate functions for managing master data: `crud-mahasiswa`, `crud-dosen`, `crud-mata-kuliah`, `crud-jadwal`, `crud-ruangan`, `crud-prodi`.
* **`get-admin-dashboard`**: Fetches high-level metrics, system health, and daily trends.
* **`get-global-attendance`**: Global search for attendance across the university.
* **`get-audit-logs`**: Views the system-wide security audit trails.
* **`update-settings`**: Modifies global system configuration.
* **`update-role-permissions`**: Modifies the RBAC matrix.
* **`get-notifications`**: Manages the admin/system notification inbox.

---

## 3. Security Architecture Highlights
1. **Dynamic QR Codes**: QR codes are not static strings. They are signed JWT tokens containing the `sesi_id` and a `server_timestamp` that expire after 15 seconds.
2. **Double Verification**: Attendance requires both the physical presence (Geofence GPS distance < Radius calculated via Haversine formula) and Network presence (IP within `ip_whitelist` CIDR blocks).
3. **Audit Trails**: All sensitive actions (e.g., manual attendance overrides, failed QR decryptions, geofence violations) are logged immutably in `audit_log`.
