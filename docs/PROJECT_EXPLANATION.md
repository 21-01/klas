# KLAS — Project Explanation

Klasifikasi lengkap proyek KLAS untuk presentasi, dokumentasi tim, dan onboarding:
apa yang dibangun, kenapa diarsitekturkan begini, dan bagaimana tiap bagiannya
bekerja. Untuk panduan mendemokan, lihat [`DEMO_GUIDE.md`](DEMO_GUIDE.md).

---

## 1. Masalah yang Diselesaikan

Absensi kampus konvensional (kertas atau panggilan) punya tiga kelemahan:
bisa dititipkan ke teman, lambat direkap, dan tidak membuktikan bahwa mahasiswa
benar-benar berada di ruang kelas.

KLAS menjawabnya dengan **verifikasi kehadiran geospasial**: mahasiswa harus
secara fisik berada di ruangan untuk memindai QR yang berubah setiap detik,
dan kehadiran diverifikasi oleh kombinasi tiga sinyal:

1. **Kepemilikan QR valid** — token terenkripsi yang diterbitkan dosen.
2. **Kedekatan fisik** — GPS mahasiswa dibandingkan koordinat ruangan.
3. **Jaringan kampus** — IP berada di subnet whitelist (opsional sebagai
   penguat, bukan syarat mutlak).

## 2. Arsitektur Tingkat Tinggi

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│ Browser (SPA)       │  HTTPS  │ Neon Function `api` (Hono)       │
│ React 19 + RRv8     ├────────►│  ├─ CORS + JWT verify (JWKS)     │
│ Tailwind v4         │  Bearer │  ├─ routes: auth, attendance,    │
│                     │         │  │   dosen, admin, realtime      │
│ Neon Auth cookie    │         │  └─ lib: db, qr, geo, audit,     │
│ (@neon/auth)        │         │      storage, env                │
└─────────┬───────────┘         └───────────┬──────────┬───────────┘
          │ WSS                             │ SQL      │ S3 API
          ▼                                 ▼          ▼
┌─────────────────────┐         ┌──────────────┐  ┌──────────────┐
│ Neon Realtime       │         │ Neon Postgres│  │ Neon Object  │
│ sealed live queries │         │ + PostGIS    │  │ Storage      │
└─────────────────────┘         └──────────────┘  └──────────────┘
```

Semua backend berjalan di **satu proyek Neon** (branch `production`), wilayah
`ap-southeast-1` — dekat pengguna, dan seluruh layanan (database, auth,
function, realtime, storage) mengikuti branch yang sama.

## 3. Kenapa Arsitektur Ini Dipilih

| Keputusan | Alasan |
| --- | --- |
| **1 Neon Function, bukan 37 edge function** | Deployment satu unit, log/monitoring terpusat, cold-start sekali. Nama route dipertahankan persis (`/check-in`, `/get-dosen-dashboard`, …) sehingga frontend tidak berubah bentuk panggilannya. |
| **Authorization di kode, bukan RLS** | RLS Supabase tidak berlaku di Neon (skema auth berbeda). Semua guard (`requireAdmin`, `assertSessionAccess`, `assertJadwalAccess`) eksplisit di `neon-api/lib/auth.ts` — mudah diaudit, ada satu tempat untuk dicari. |
| **Neon Auth (Managed Better Auth)** | Tidak perlu mengelola server auth; JWT EdDSA 15 menit diverifikasi via JWKS; cookie HTTP-only di domain auth. |
| **Sealed live queries** | Dosen melihat check-in masuk tanpa polling. API menerbitkan *capability* terenkripsi berumur pendek — klien tidak pernah pegang koneksi database. |
| **QR terenkripsi AES-GCM** | QR tidak bisa dipalsukan tanpa `QR_SECRET`; token kedaluwarsa cepat (15 s) dan sekali pakai per sesi. |
| **Object Storage untuk ekspor** | Laporan CSV di-upload ke bucket `assets` (private) — bisa diunduh ulang tanpa regenerasi. |
| **Cron setiap 5 menit** | `auto_close_stale_sessions()` + `cleanup_expired_qr_codes()` menjaga kebersihan data tanpa intervensi. |

## 4. Alur Data Inti

### 4.1 Check-in (jalur paling penting)

```
Dosen: open-session ──► generate-qr-token (batch 2, TTL 15 s)
                              │ AES-GCM(qr_secret)
Mahasiswa: scan QR ──► POST /check-in { qr_token, lat, lng }
                              │
                    1. decrypt token → sesi_id + timestamp
                    2. sesi harus status "live"
                    3. Haversine(mahasiswa, ruangan) vs radius
                    4. IP vs ip_whitelist
                    5. INSERT presensi (status: present/late,
                       geofence_flagged, geofence_delta_m)
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
Dosen layar: live log bertambah            Audit log tercatat
(Neon Realtime sealed query)               (kategori Attendance)
```

### 4.2 Peran & izin

| Aksi | Mahasiswa | Dosen | Admin |
| --- | --- | --- | --- |
| Check-in sendiri | ✓ | — | — |
| Buka/tutup sesi, QR, koreksi kelasnya | — | ✓ (jadwal miliknya) | ✓ |
| Master data, jadwal global, audit log | — | — | ✓ |
| Ekspor laporan | — | ✓ | ✓ |

## 5. Struktur Kode

| Direktori | Isi |
| --- | --- |
| `app/` | SPA React: `lib/` (api, auth, realtime, types), `routes/` per role (`admin/`, `dosen/`, root untuk mahasiswa), `components/` |
| `neon-api/` | Hono app: `index.ts` (mounts + CORS), `routes/*.ts` (endpoint), `lib/*.ts` (env, db, auth, qr, geo, audit, storage), `CONTRACT.md` |
| `neon/` | `neon.ts` (IaC: auth, functions, buckets, triggers), `sql/001_functions.sql` (helper DB) |
| `supabase/migrations/` | Skema kanonik 001–004 (source of truth DDL) |
| `scripts/` | `db.mjs` (schema runner), `auth-users.mjs`, `seed.mjs`, `reset-demo.mjs`, smoke tests, verifikasi headless |
| `docs/` | `DEMO_GUIDE.md`, arsitektur, fitur, PRD, style |

## 6. Keamanan — Ringkas

| Lapisan | Mekanisme |
| --- | --- |
| Transport | HTTPS wajib (Neon + Vercel) |
| Auth | Password via Neon Auth; JWT EdDSA 15 menit; cookie session HTTP-only Partitioned |
| Brute force | `check_and_record_failed_login` — 5 gagal/60 s per IP+email |
| Role | `requireRole` / `requireAdmin` di setiap route tulis |
| Kepemilikan | Dosen hanya bisa menyentuh sesi/jadwal miliknya (`assertSessionAccess`, `assertJadwalAccess`) |
| QR | AES-GCM + TTL + sekali pakai + rotate |
| CORS | Allowlist origin eksplisit (`KLAS_CORS_ORIGINS`) |
| Audit | Semua aksi tulis + percobaan gagal tercatat |
| Demo | `KLAS_DEMO_MODE=true` mematikan endpoint destruktif |
| Secrets | `QR_SECRET` ≥32 char; env Neon, tidak ada di repo |

## 7. Kualitas & Verifikasi

- `pnpm typecheck` — TypeScript ketat, tanpa `any` baru di jalur kritis.
- `pnpm build` — build SPA produksi.
- `scripts/smoke.mjs` / `smoke-realtime.mjs` — end-to-end API + Realtime
  (28 + 5 assertion) langsung ke backend ter-deploy.
- `scripts/verify-all-routes.mjs` — headless sweep 20 route × 4 viewport ×
  3 role: cek overflow horizontal dan error konsol.
- `scripts/verify-dashboard.mjs`, `verify-404.mjs` — verifikasi visual
  per-halaman.

## 8. Batasan yang Diketahui

- SPA mode: server selalu mengembalikan 200 (routing 404 terjadi di klien).
- JWT 15 menit — sesi browser di-refresh lewat cookie; tidak ada refresh token
  API terpisah.
- Check-in di luar geofence ditandai, tidak diblokir (keputusan produk; admin
  dapat melihatnya di dashboard "Geofence Violation Alerts").
- Scanner QR butuh kamera + HTTPS (atau localhost) — di laptop tanpa kamera
  gunakan HP.
