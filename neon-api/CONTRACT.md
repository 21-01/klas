# KLAS Neon API — implementation contract

Single Hono app deployed as the Neon Function `api` (`neon-api/index.ts`).
Routes are mounted per domain; each route path keeps the old Supabase edge-function
name so the browser contract stays `POST /<function-name>` with a JSON body.

This file is the spec every route module implements. Do not invent new endpoints.

## Shared modules (already written — import, do not duplicate)

```ts
import { env } from "../lib/env.ts";
import { one, many, run, transaction, isUniqueViolation, pgErrorCode } from "../lib/db.ts";
import { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, ok, fail, text, body } from "../lib/http.ts";
import { currentUser, requireRole, requireAdmin, isAdmin, assertSessionAccess, assertJadwalAccess, getClientIp, ADMIN_ROLES } from "../lib/auth.ts";
import { getDistanceMeters, isIpInSubnet, DEFAULT_IP_WHITELIST } from "../lib/geo.ts";
import { encryptToken, decryptToken, randomQrSeed, randomSalt } from "../lib/qr.ts";
import { audit } from "../lib/audit.ts";
import { paginate, toCsv, jakartaToday, jakartaDayName, lastNDates, round2, rate, formatDistance } from "../lib/util.ts";
```

- `one<T>(sql, params)` → first row or `null`; `many<T>(sql, params)` → rows.
- `ok(c, data, status?)` → JSON + CORS. `text(c, csv, filename)` → CSV download.
- Throw `new HttpError(status, message)` for failures. The app-level `onError`
  turns it into `{ error: message }` with the right status — routes must **not**
  try/catch just to build an error response.
- No RLS exists on Neon. Authorization is enforced **in code** via
  `currentUser` / `requireRole` / ownership checks. Never trust a body-supplied
  `user_id`.
- Zod 4 is available (`import { z } from "zod"`); use `z.email()` not
  `z.string().email()`. Validate request bodies with `schema.parse(...)` and let
  the thrown error surface as 400 (wrap in `badRequest` if the message is ugly).

## Behaviour changes from the Supabase version

| Old | New |
| --- | --- |
| `auth.getUser(jwt)` | `currentUser(c)` — verifies the Better Auth JWT and loads `public.users` |
| `select role from users where user_id` per handler | `currentUser(c).role` (already loaded) |
| `auth.admin.createUser` | `provisionAuthUser()` in `lib/neon-auth.ts` (see below) |
| `auth.signInWithPassword` | `signInWithPassword()` in `lib/neon-auth.ts` |
| service-role client writes | plain `pg` queries (`run`, `transaction`) |
| `getUserClient(jwt)` RLS-scoped reads | explicit `where user_id = $1` predicates |

`neon-api/lib/neon-auth.ts` (written by the auth lane) exports:

```ts
signInWithPassword(email, password): Promise<{ user: { id, email, name }, token: string }>
signUpWithPassword(email, password, name): Promise<{ user: { id, email, name } }>
changePassword(userId, currentPassword, newPassword): Promise<void>
```

## Response envelopes (must stay byte-compatible with the old functions)

- Error: `{ error: string }` (handled by `HttpError`).
- `{ message: string }` for mutations.
- Lists: `{ <items>, pagination: { page, limit, total, total_pages } }`.
- CSV: raw text body, `Content-Type: text/csv`, `Content-Disposition: attachment`.

## Demo credentials

All demo users share the password in `scripts/auth-users.mjs`
(`KlasDemo#2026`). `public.users.user_id` equals the Neon Auth user id.

---

## auth.ts — auth, profile, student self-service, notifications

### `POST /login` (public)
Body `{ email, password }` (zod). Steps:
1. `getClientIp(c)` + `check_and_record_failed_login(ip::inet, email, 60, 5)` via
   `select * from public.check_and_record_failed_login($1::inet,$2,60,5)`.
2. If `blocked` → insert `notifikasi` (tipe `brute_force`, `user_id` null-safe) and
   `audit` (`Authentication`, failed), throw `HttpError(429, "Too many failed attempts. Try again later.")`.
3. `signInWithPassword(email, password)`. On failure: audit failed, throw 401
   `"Invalid email or password"`.
4. On success: `delete from failed_login_attempts where ip_address = $1`.
5. Load `public.users` by `user_id`; if missing, 403 `"User profile not found"`.
6. Audit success (`Authentication`).
7. Return `{ session: { access_token, refresh_token, expires_at, cookie? }, user: { id, email, name, role } }`
   where `access_token` is the Better Auth JWT, `refresh_token` the session token,
   `expires_at` an ISO string ~7 days out, and `cookie` (when available) the signed
   `__Secure-neon-auth.session_token=...` pair for non-browser refresh.

### `POST /refresh-session` (public)
Body `{ refresh_token, cookie? }`; the signed session cookie may also arrive in the
`Cookie` header. If a cookie is supplied, its session token must equal
`refresh_token`, otherwise 401 `"Session cookie does not match refresh token"`.
Verify the session still exists in `neon_auth.session` by `token = $1` and not expired.
Return `{ session: { access_token: <fresh JWT>, refresh_token, expires_at }, user: {...} }`.
Mint the JWT by calling `GET {NEON_AUTH_BASE_URL}/token` with the signed cookie
(fallback: reuse `refresh_token` as access token and log a warning).

### `POST /change-password`
`currentPassword` check then update, via `changePassword(user.userId, current_password, new_password)`.
Body `{ current_password, new_password }` (min 8). Audit (`Security Policies`) on
success and on failure (status `failed`). Return `{ message: "Password updated successfully" }`.

### `POST /get-my-profile`
Return by role:
- `dosen`: `{ user_id, email, role, nama }`
- `admin|super_admin|admin_prodi`: `{ user_id, email, role, name }`
- `mahasiswa`: `{ user_id, email, role, nim, nama, angkatan, jenis_kelamin, gpa, pembimbing_akademik, prodi: { kode_prodi, nama_prodi } }`

### `POST /get-my-dashboard`
Mahasiswa only. `{ date, day, classes: [{ jadwal_id, mata_kuliah: { kode_mk, nama_mk, sks }, waktu_mulai, waktu_selesai, ruangan, sesi_id, sesi_status }] }`.
Only that day's classes (`hari = dayName`), latest session per jadwal.

### `POST /get-my-logs`
Body `{ page=1, limit=20, semester?, tahun_akademik? }` (limit 1..100).
`{ logs: [{ presensi_id, waktu_check_in, status, metode, latitude, longitude, geofence_flagged, geofence_delta_m, sesi: { tanggal, waktu_mulai, waktu_selesai, mata_kuliah: { kode_mk, nama_mk, sks } } }], pagination }`
Ordered `waktu_check_in desc`.

### `POST /get-attendance-stats`
Body `{ semester?, tahun_akademik? }`.
`{ total_sessions, breakdown: { present, absent, excused, late }, attendance_rate, semester, tahun_akademik }`
Rate = `(present+late)/total*100` rounded to 2dp.

### `POST /get-notifications`
Body `{ action: "list"|"mark-read"|"mark-all-read"|"stats", ... }`.
- `list`: `{ notifications: [{ ...notifikasi, user: { user_id, email, name, role } | null }], pagination }`; non-admins are forced to their own `user_id`.
- `mark-read`: `{ message }`; `notifikasi_id` may be a uuid or uuid[].
- `mark-all-read`: `{ message }`; non-super_admin only their rows.
- `stats`: `{ total, unread, by_type: Record<string, number> }`.

### `POST /provision-user`
Admin roles. Body per zod: `{ email, password(>=8), name, role: "mahasiswa"|"dosen", identifier, prodi_id }`.
1. `signUpWithPassword` → auth user id.
2. In a transaction: insert `users` (role), then `mahasiswa(nim, nama, user_id, prodi_id)`
   or `dosen(nip, nama, user_id, prodi_id)`.
3. On failure, delete the created auth user (best effort) and rethrow.
Return 201 `{ message, user_id, role, identifier }`. Audit `Master Data`.

---

## attendance.ts — check-in, QR, sessions, attendance overrides

Shared ownership: `assertSessionAccess(user, sesi_id)` throws 403 unless admin or
the lecturer owns the schedule; `assertJadwalAccess(user, jadwal_id)` for schedules.

### `POST /check-in`
Mahasiswa only (must have a `mahasiswa` row). Body `{ qr_token, latitude, longitude }`.
1. `decryptToken(qr_token)` → `{ sesi_id, server_timestamp, security_salt_token }`.
2. Load session + `qr_rotates_every`; TTL = `qr_rotates_every + 5` seconds; if
   `|now - server_timestamp| > ttl*1000` → 400 `"QR code expired"` (+ audit failed `Geofence`).
3. Session must be `live`.
4. Geofence: distance from `ruangan.latitude/longitude`; if `> geofence_radius_m` →
   record `late` with `geofence_flagged = true`, else `present` with `geofence_flagged = false`.
   `geofence_delta_m` = distance - radius (never negative), store 2dp.
5. IP allowlist: `select cidr from ip_whitelist` ∪ `DEFAULT_IP_WHITELIST`; if the
   client IP is outside, still allow but set `geofence_flagged = true` and mention it
   in the message (old code used the same flag).
6. Insert `presensi` (`metode: "qr"`, `waktu_check_in: now()`). Unique violation
   (`23505`) → 409 `"You have already checked in for this session"`.
7. Audit success. Return `{ message, status, room, distance }` where `distance` is
   `formatDistance(...)`.

### `POST /generate-qr-token`
Admin or session owner. Body `{ sesi_id, ttl_seconds (5..60), covers (1..5, default 2) }`.
`count = ceil((covers*60)/ttl_seconds)`. For `i` in 0..count-1: payload
`{ sesi_id, server_timestamp: Date.now() + i*ttl*1000, security_salt_token: randomSalt() }`,
`encryptToken(JSON.stringify(payload))`, `expired_at = server_timestamp + ttl*1000`.
Insert all rows into `qr_code (sesi_id, token, expired_at)` in one statement.
Return `{ tokens: [{ qr_token, expired_at }], ttl_seconds }`.

### `POST /open-session`
Body `{ jadwal_id, tanggal?, geofence_radius_m?, qr_rotates_every? }`.
Reject 409 if a `live` session already exists for that schedule. Insert
`sesi_kehadiran` with `status='live'`, `waktu_mulai=now()`, `qr_seed=randomQrSeed()`,
`tanggal = body.tanggal ?? jakartaToday()`, radius default from
`jadwal_kelas → ruangan.geofence_radius_m` (fallback 50), rotation default 15.
Audit `Schedule Plotting`. Return 201 `{ sesi_id, status: "live", qr_seed }`.

### `POST /close-session`
Body `{ sesi_id }`. Set `status='completed'`, `waktu_selesai=coalesce(waktu_selesai, now())`. Audit. `{ message }`.

### `POST /get-live-session`
Roles: admin, super_admin, admin_prodi, dosen. Body `{ sesi_id }`. Ownership check.
Return
`{ sesi_id, status, waktu_mulai, geofence_radius_m, qr_rotates_every, counts: { present, absent }, recent_checkins: [{ presensi_id, waktu_check_in, status, mahasiswa_id, nim, nama }] }`
(`present` = presensi with status in present/late/excused; `absent = max(0, enrolled - present)`;
`recent_checkins` latest 20, ordered `waktu_check_in desc`).

### `POST /list-sessions`
Body `{ jadwal_id, page=1, limit=10 }` (limit 1..100). Ownership check.
`{ sessions: [{ sesi_id, jadwal_id, tanggal, waktu_mulai, waktu_selesai, status, geofence_radius_m, qr_rotates_every, present_count, absent_count, total_count }], pagination }`
Ordered `tanggal desc, waktu_mulai desc`. Audit (`Schedule Plotting`, action "list-sessions").

### `POST /update-session-settings`
Body `{ sesi_id, geofence_radius_m? (10..500), qr_rotates_every? (5..60) }`. Ownership.
Update only provided fields (empty body still returns success). Audit. `{ message }`.

### `POST /update-session`
Body `{ sesi_id, tanggal?, geofence_radius_m?, qr_rotates_every? }`. Ownership.
400 `"No fields to update"` when empty. Audit. `{ message }`.

### `POST /reopen-session`
Body `{ sesi_id, tanggal?, geofence_radius_m?, qr_rotates_every? }`. Ownership.
Only `completed` sessions are reopenable (400 otherwise). Reject 409 if another live
session exists for the schedule. Update `status='live'`, `waktu_selesai=null`,
`waktu_mulai=now()`, `qr_seed=randomQrSeed()`. Audit. `{ sesi_id, status: "live" }`.

### `POST /delete-session`
Body `{ sesi_id }`. Ownership. In a transaction delete `presensi`, `qr_code`, then
the session. Audit. `{ message }`.

### `POST /correct-attendance`
Body `{ presensi_id, status_baru (present|absent|excused|late), alasan? }`.
Load presensi + owning `dosen_id`; ownership check. Insert `koreksi_presensi`
(`status_sebelum`, `status_sesudah`, `alasan`, `diubah_oleh` = user id), update
`presensi.status`. Audit `Attendance Overrides`. `{ message }`.

### `POST /bulk-mark-present`
Body `{ sesi_id, mahasiswa_ids: uuid[] (1..200), status: present|absent|excused|late }`.
Ownership. For each student: if a `presensi` row exists and the status differs, update
it and insert `koreksi_presensi`; otherwise insert a `presensi` row with `metode: "manual"`.
Return `{ message, updated, inserted }`. Audit.

---

## dosen.ts — lecturer dashboard, profile, course rosters, reports

### `POST /get-dosen-dashboard`
Lecturer self.
`{ dosen: { nama }, courses: [{ jadwal_id, mata_kuliah: { kode_mk, nama_mk, sks }, hari, waktu_mulai, waktu_selesai, semester, ruangan, enrolled, latest_session: { sesi_id, status, tanggal } | null }] }`.

### `POST /get-dosen-profile`
`{ dosen_id, nip, nidn, nama, jenis_kelamin, prodi: { kode_prodi, nama_prodi }, email }`.

### `POST /update-dosen-profile`
Body `{ nama?, jenis_kelamin? }`. 400 when empty. Update `dosen`; when `nama`
changes also update `neon_auth."user".name` and `public.users.name`. Audit. `{ message }`.

### `POST /get-course-students`
Roles admin/super_admin/admin_prodi/dosen. Body
`{ jadwal_id, page=1, limit=50, search?, sesi_id? }`. Lecturer ownership check.
`{ students: [{ mahasiswa_id, nim, nama, gpa, attendance: { presensi_id, status, waktu_check_in, geofence_flagged } | null }], pagination }`.

### `POST /get-dosen-report`
Roles admin tier or dosen (ownership). Body `{ jadwal_id }`.
`{ course: { kode_mk, nama_mk, sks }, schedule: { hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, ruangan }, total_sessions, total_students, overall_attendance_rate, students: [{ nim, nama, gpa, attendance: { present, absent, excused, total }, rate }] }`
(`present` includes `late`; `rate` is a percentage rounded to 2dp).

### `POST /export-report`
Roles admin tier or dosen (ownership). Body `{ jadwal_id, format }` (`csv` only).
CSV header `NIM,Nama,<dates>,Rate`; per student a row of `P`/`E`/`A` per session and
the rate. **Also upload the CSV to Object Storage** (`env.objectStorage.bucket`,
key `reports/<jadwal_id>-<timestamp>.csv`) via the S3-compatible API and log the key;
the response body stays the CSV text with
`Content-Disposition: attachment; filename="report-<jadwal_id>.csv"`.

> Object Storage helper: use `Bun`-free AWS SigV4 is not available; instead write
> `neon-api/lib/storage.ts` with `putObject(key, body, contentType): Promise<string>`
> using `fetch` to `${AWS_ENDPOINT_URL_S3}/${bucket}/${key}` with a presigned-style
> header set generated by `crypto.subtle` HMAC (AWS SigV4). Return the object key.
> Keep it dependency-free and non-blocking: on upload failure log a warning and still
> return the CSV.

---

## admin.ts — admin dashboards, global attendance, audit logs, CRUD

All routes require `requireAdmin(c)` unless noted. CRUD actions are discriminated by
the body's `action` field; preserve the exact success envelopes listed below.

### `POST /get-admin-dashboard`
Return
`{ total_students, total_lecturers, total_courses, total_rooms, active_sessions_today, completed_sessions_today, total_sessions_all_time, total_enrollments, overall_attendance_rate, students_with_low_attendance, attendance_trend: [{ date, present_count, absent_count }] , geofence_violations }`.
Jakarta "today"; trend covers the last 7 days (use `lastNDates(7)`); low attendance =
students whose rate is below 75%.

### `POST /get-global-attendance`
Body `{ status?, tanggal?, jadwal_id?, page=1, limit=20 }` (limit 1..100).
`{ sessions: [{ sesi_id, tanggal, waktu_mulai, waktu_selesai, status, mata_kuliah, dosen, ruangan, enrolled_count, attendance_counts: { present, absent, excused, late, total }, attendance_rate }], pagination }`.
Ordered `tanggal desc, waktu_mulai desc`.

### `POST /get-admin-attendance-courses`
`{ courses: [{ jadwal_id, mata_kuliah: { mk_id, kode_mk, nama_mk, sks }, dosen: { dosen_id, nama }, hari, waktu_mulai, waktu_selesai, semester, ruangan: null, enrolled, latest_session: { sesi_id, status, tanggal } | null }] }`.
`admin_prodi` only sees courses in their own `prodi_id`.

### `POST /get-audit-logs`
Body `{ page=1, limit=50 (1..200), kategori?, status?, search?, from_date?, to_date?, user_id?, format="json" }`.
- json: `{ logs: [{ log_id, user_id, timestamp, kategori, aksi, ip_address, status, metadata, created_at, user: { name, email } | null }], pagination }`
- csv: `Timestamp,User,Email,Kategori,Aksi,IP Address,Status` with `Content-Disposition: attachment; filename="audit-logs.csv"`.

### CRUD routes
Each takes `{ action, ...payload }` and returns the envelope noted.

- `POST /crud-mahasiswa` — list `{ mahasiswa, pagination }`; get/create/update bare row;
  delete `{ message }`. Create/update may provision an auth user via
  `signUpWithPassword` (email+password given); roll back the auth user if the
  `mahasiswa` insert fails. Soft delete (`is_active=false`).
- `POST /crud-dosen` — list `{ data, total, page, limit }`; get/create/update bare row;
  delete `{ message }`. Soft delete.
- `POST /crud-mata-kuliah` — list `{ data, pagination }`; get/create/update `{ data, mk_id }`;
  delete `{ message, mk_id }`. Hard delete; `23505` → 409.
- `POST /crud-jadwal` — list `{ jadwal, pagination }`; get bare row; create/update `jadwal`;
  delete `{ message }`; `list-enrolled` `{ enrolled }`; `toggle-enroll` `{ enrolled: boolean }`.
  Soft delete. Status derived: `unassigned` | `room-missing` | `assigned`.
- `POST /crud-ruangan` — list `{ data, total, page, per_page }`; get/create/update `{ data }`;
  delete `{ message }`. Soft delete.
- `POST /crud-prodi` — roles admin/super_admin/admin_prodi. list/get `{ data }`;
  create/update `{ message, data }`; delete `{ message }`. Hard delete blocked with
  409 when `mahasiswa`/`dosen`/`mata_kuliah` still reference the prodi.

All CRUD writes append an `audit_log` row with the matching category
(`Master Data` for master tables, `Schedule Plotting` for schedules).
