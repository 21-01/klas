# Dosen Session Management — Implementation Plan

## Overview

Add ability for dosen to view, edit (reopen + settings), and delete past class sessions via a new sessions history page.

---

## Phase 1: Backend — New Edge Functions

### 1a. `list-sessions`

- **Input:** `{ jadwal_id: string, page?: number, limit?: number }`
- **Logic:** Query `sesi_kehadiran` by `jadwal_id`, LEFT JOIN `presensi` for attendance counts
- **Output:** `{ sessions: [SessionHistoryItem], pagination: Pagination }`
- **Auth:** Dosen ownership check via `jadwal_kelas.dosen_id`

### 1b. `delete-session`

- **Input:** `{ sesi_id: string }`
- **Logic:** Cascade delete: `presensi` → `qr_code` → `sesi_kehadiran`
- **Output:** `{ message: "Session deleted successfully" }`
- **Auth:** Dosen ownership check

### 1c. `reopen-session`

- **Input:** `{ sesi_id: string, tanggal?: string, geofence_radius_m?: number, qr_rotates_every?: number }`
- **Logic:** Validate session is `completed`, update status to `live`, clear `waktu_selesai`, generate new `qr_seed`
- **Output:** `{ sesi_id: string, status: "live" }`
- **Auth:** Dosen ownership check

### 1d. `update-session`

- **Input:** `{ sesi_id: string, tanggal?: string, geofence_radius_m?: number, qr_rotates_every?: number }`
- **Logic:** Update only provided fields on `sesi_kehadiran`
- **Output:** `{ message: "Session updated successfully" }`
- **Auth:** Dosen ownership check

---

## Phase 2: Frontend — Types & API

### 2a. New Types (`app/lib/types.ts`)

```typescript
SessionHistoryItem {
  sesi_id, jadwal_id, tanggal, waktu_mulai, waktu_selesai,
  status, geofence_radius_m, qr_rotates_every,
  present_count, absent_count, total_count
}

ListSessionsResponse { sessions, pagination }
DeleteSessionRequest { sesi_id }
ReopenSessionRequest { sesi_id, tanggal?, geofence_radius_m?, qr_rotates_every? }
UpdateSessionRequest { sesi_id, tanggal?, geofence_radius_m?, qr_rotates_every? }
```

### 2b. New API Methods (`app/lib/api.ts`)

| Method | Edge Function |
|---|---|
| `api.listSessions(jadwal_id, page?, limit?)` | `list-sessions` |
| `api.deleteSession(sesi_id)` | `delete-session` |
| `api.reopenSession(req)` | `reopen-session` |
| `api.updateSession(req)` | `update-session` |

---

## Phase 3: Frontend — Sessions Page

### Route

```
/dosen/attendance/:jadwal_id/sessions
```

### Page: `app/routes/dosen/sessions.tsx`

- Back button → `/dosen/attendance/:jadwal_id`
- Title: "Session History — {kode_mk} - {nama_mk}"
- Session cards list, each showing:
  - Date + time range
  - Status badge (LIVE / COMPLETED)
  - Attendance stats (present/absent/total, rate %)
  - Action buttons: View, Edit, Reopen, Delete
- Edit modal: date picker + geofence slider + QR rotation slider
- Reopen flow: confirm → api.reopenSession → navigate to attendance
- Delete flow: confirm ("permanently delete session + all attendance records") → api.deleteSession
- Pagination: "Load More" button

---

## Phase 4: Navigation Links

- **Dashboard** (`dashboard.tsx`): Add "Sessions" link on each course card
- **Attendance** (`attendance.tsx`): Add "Session History" link in header

---

## Phase 5: Tests

`tests/dosen/sessions.test.tsx`:
- Renders session list
- Edit modal opens/saves
- Reopen confirmation works
- Delete removes from list
- Empty state
- Load More pagination

---

## Files Summary

| File | Action |
|---|---|
| `supabase/functions/list-sessions/index.ts` | CREATE |
| `supabase/functions/delete-session/index.ts` | CREATE |
| `supabase/functions/reopen-session/index.ts` | CREATE |
| `supabase/functions/update-session/index.ts` | CREATE |
| `app/lib/types.ts` | MODIFY |
| `app/lib/api.ts` | MODIFY |
| `app/routes.ts` | MODIFY |
| `app/routes/dosen/sessions.tsx` | CREATE |
| `app/routes/dosen/dashboard.tsx` | MODIFY |
| `app/routes/dosen/attendance.tsx` | MODIFY |
| `tests/dosen/sessions.test.tsx` | CREATE |
