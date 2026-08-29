# Klas. Edge Functions Reference

This document provides a detailed overview of the Supabase Edge Functions built for the Klas. platform. These functions encapsulate business logic, secure database access, external API integrations, and cryptographic operations.

## Architecture & Shared Utilities
All edge functions are stored under `supabase/functions/`. They share utilities located in `_shared/`:
* **`cors.ts`**: Implements preflight CORS handling for all web requests.
* **`supabase.ts`**: Provides initialized Supabase Admin clients (bypassing RLS for secure, server-side-only operations) and JWT extraction helpers.
* **`crypto.ts`**: Handles symmetric AES-GCM encryption/decryption for QR token payloads.
* **`geofence.ts`**: Implements the Haversine formula for calculating distance between GPS coordinates and CIDR subnet matching for IP whitelists.
* **`zod-schemas.ts`**: Centralized Zod validation schemas for standardizing and sanitizing incoming request payloads.

---

## 1. Authentication & User Management

### `login`
* **Purpose**: Authenticates a user and issues a JWT session token.
* **Payload**: `{ email: string, password: string }`
* **Flow**: Validates credentials via Supabase Auth, checks against brute-force logs, and returns user data along with the session.

### `refresh-session`
* **Purpose**: Exchanges an expired access token for a new one using a refresh token.
* **Payload**: `{ refresh_token: string }`
* **Security**: Essential for maintaining long-lived sessions on the client side without requiring re-login.

### `change-password`
* **Purpose**: Allows logged-in users to securely update their passwords.
* **Payload**: `{ current_password: string, new_password: string }`
* **Security**: Requires an active JWT Authorization header. Validates current password before updating.

### `provision-user`
* **Purpose**: Admin-only endpoint to create a new user account (Mahasiswa or Dosen) and simultaneously create their respective profile record.
* **Payload**: `{ email, password, name, role, identifier (NIM/NIP), prodi_id }`
* **Security**: Only invocable by users with the `admin` role. Handles transaction-like creation of Auth user + Public profile.

---

## 2. Check-In & Security (QR Code System)

### `generate-qr-token`
* **Purpose**: Generates a batch of secure, encrypted, rotating QR code tokens for a live attendance session.
* **Payload**: `{ sesi_id: string, ttl_seconds: number, covers?: number }`
  * `ttl_seconds`: QR rotation interval (5–60s, matches `qr_rotates_every` from session settings)
  * `covers`: Duration in minutes the batch should cover (default: 2, range: 1–5)
* **Flow**:
  1. Authenticates user and verifies lecturer/admin permissions.
  2. Validates session exists and is in `live` status.
  3. Generates `Math.ceil(covers * 60 / ttl_seconds)` tokens in a single request:
     * Each token has a unique random `security_salt_token` for cryptographic separation.
     * Each token has a staggered `server_timestamp` (offset by `ttl_seconds` per index) so each is valid in its own 15s window.
     * All tokens are encrypted with AES-GCM using the `QR_SECRET`.
  4. Batch-inserts all tokens into the `qr_code` table in one DB write.
  5. Returns `{ tokens: [{ qr_token, expired_at }], ttl_seconds }`.
* **Performance**: Reduces edge function invocations from ~200 to ~17 per 50-minute session (at default 15s rotation, 2-minute coverage).

### `check-in`
* **Purpose**: Processes a student's attendance request.
* **Payload**: `{ qr_token: string, latitude: number, longitude: number }`
* **Flow**:
  1. Decrypts the `qr_token` and validates TTL (must be < 15 seconds old).
  2. Verifies the student's GPS location against the classroom's geofence radius.
  3. Verifies the student's IP address against the campus `ip_whitelist` CIDR blocks.
  4. Inserts a record into `presensi` marking them as `present` or `late` (if geofence flagged).
  5. If flagged, triggers an automatic database notification to the lecturer.

---

## 3. Lecturer (Dosen) Operations

### `open-session`
* **Purpose**: Initiates a live class session.
* **Payload**: `{ jadwal_id: string, tanggal?: string, geofence_radius_m?: number, qr_rotates_every?: number }`
* **Logic**: Ensures no active session exists for the schedule. Creates a `sesi_kehadiran` row and generates the first `qr_seed`.

### `close-session`
* **Purpose**: Ends a live class session.
* **Payload**: `{ sesi_id: string }`
* **Logic**: Marks `status = 'completed'` and prevents any further check-ins.

### `update-session-settings`
* **Purpose**: Updates settings for an active live session.
* **Payload**: `{ sesi_id: string, geofence_radius_m?: number, qr_rotates_every?: number }`
* **Logic**: Updates the session's geofence radius or QR rotation interval. Logs the change in the `audit_log`.

### `get-live-session`
* **Purpose**: Real-time polling endpoint for the lecturer dashboard.
* **Payload**: `{ sesi_id: string }`
* **Returns**: Active session status, check-in counts (present/absent), and a list of the 20 most recent check-in logs. 

### `get-dosen-report` / `export-report`
* **Purpose**: Aggregates attendance statistics for a specific course/schedule.
* **Payload**: `{ jadwal_id: string, format?: "csv" | "json" }`
* **Returns**: Comprehensive attendance percentages per student, optionally formatted as a downloadable CSV.

### `get-dosen-profile` / `update-dosen-profile`
* **Purpose**: Fetches or updates the lecturer's profile (name, gender). Updates sync to Supabase Auth metadata.

### `list-sessions` / `delete-session` / `reopen-session` / `update-session`
* **Purpose**: Session history management — list past sessions (paginated), delete a session and its records, reopen a completed session, or update session parameters (date, geofence radius, QR rotation).
* **Auth**: Dosen ownership check via `jadwal_kelas.dosen_id`.

### `bulk-mark-present` & `correct-attendance`
* **Purpose**: Manual override tools for lecturers to fix attendance issues.
* **Security**: All overrides are permanently recorded in the `audit_log` table for administrative review.

---

## 4. Student (Mahasiswa) Operations

### `get-my-dashboard`
* **Purpose**: Fetches the student's daily schedule.
* **Returns**: List of today's classes, including the `sesi_id` and `sesi_status` if the lecturer has opened the session.

### `get-my-profile`
* **Purpose**: Fetches the student's academic profile with program studi info.
* **Returns**: NIM, name, GPA, angkatan, pembimbing akademik, prodi details, and email.

### `get-my-logs` & `get-attendance-stats`
* **Purpose**: Retrieves paginated historical check-in logs and calculates the total percentage of classes attended across the semester.
* **Filters**: Supports semester and tahun_akademik filtering.

---

## 5. Administrative Data & System Management

### `crud-*` Functions
* **Purpose**: `crud-mahasiswa`, `crud-dosen`, `crud-mata-kuliah`, etc.
* **Logic**: Thin, secure wrappers around PostgreSQL CRUD operations. They enforce business rules (e.g., preventing deletion of entities with active foreign keys) and log administrative actions.

### `get-admin-dashboard`
* **Purpose**: Provides high-level metrics for the super-admin.
* **Returns**: Total students, active sessions, system health alerts, and a 7-day attendance trend array.

### `get-global-attendance`
* **Purpose**: Provides a university-wide view of all active and recent attendance sessions.
* **Payload**: `{ status?: "live" | "completed", page?: number, limit?: number }`
* **Returns**: Paginated list of sessions with course info, lecturer, room, attendance progress, and status badges.

### `get-audit-logs`
* **Purpose**: Retrieves the system-wide security audit trails for compliance and monitoring.
* **Payload**: `{ page?: number, limit?: number, kategori?: string }`
* **Returns**: Paginated audit log entries with timestamp, user, role, category, action, IP address, and status.

### `update-settings` & `update-role-permissions`
* **Purpose**: Dynamic system configuration without requiring redeployments.
* **Logic**: Updates the `konfigurasi_sistem` and `role_permissions` tables, respectively, dictating global limits and RBAC access rights.

### `get-notifications`
* **Purpose**: Manages the in-app notification inbox — list, mark-read, mark-all-read, and get unread stats.
* **Auth**: Any authenticated user (notifications are filtered by `user_id`).
