# KLAS Demo Guide

Panduan lengkap untuk mendemokan KLAS (Geospatial Presence Verification
System) — dari menyiapkan data demo hingga menjalankan alur lengkap
mahasiswa, dosen, dan admin.

---

## 1. Ringkasan Proyek

KLAS menggantikan absensi manual dengan verifikasi kehadiran yang aman dan
sulit dipalsukan. Tiga mekanisme digabungkan:

| Mekanisme | Cara kerja |
| --- | --- |
| **Dynamic QR** | QR token dienkripsi AES-GCM (`QR_SECRET`), di-rotate otomatis (default 15 detik), dan hanya bisa dipakai satu kali per sesi. |
| **GPS Geofencing** | Jarak siswa–ruangan dihitung server-side (Haversine) dibanding radius ruangan/sesi. Di luar radius → tetap masuk tapi ditandai `geofence_flagged`. |
| **IP Whitelist** | IP kampus dicek dengan CIDR match; di luar whitelist juga ditandai, bukan diblokir. |

**Stack**: React 19 + React Router v8 (SPA) + Tailwind v4 di depan;
Neon (PostgreSQL + PostGIS + Functions + Auth + Realtime + Object Storage)
di belakang. Semua logika berjalan di satu Neon Function (`neon-api/`, Hono).

Peran pengguna:

| Role | Portal | Kemampuan inti |
| --- | --- | --- |
| **Mahasiswa** | `/mahasiswa` | Lihat jadwal hari ini, scan QR untuk check-in, riwayat kehadiran, profil |
| **Dosen** | `/dosen` | Buka/tutup sesi, tampilkan QR live, pantau check-in realtime, koreksi manual, laporan, ekspor CSV |
| **Admin** | `/admin` | Dashboard analitik, master data (mahasiswa/dosen/mata kuliah/ruangan/prodi), penjadwalan, audit log |

---

## 2. Akun Demo

Semua akun memakai password yang sama: **`klasdemo`**

| Email | Role | Nama |
| --- | --- | --- |
| `admin@klas.unj.ac.id` | admin | Admin |
| `budi.santoso@unj.ac.id` | dosen | Budi Santoso |
| `siti.rahma@unj.ac.id` | dosen | Siti Rahma |
| `ahmad.fauzi@mhs.unj.ac.id` | mahasiswa | Ahmad Fauzi |
| `dewi.lestari@mhs.unj.ac.id` | mahasiswa | Dewi Lestari |
| `rizki.pratama@mhs.unj.ac.id` | mahasiswa | Rizki Pratama |

> Login menerima email; NIM/NIP juga diterima di halaman login.

Data seed: 1 prodi (Ilmu Komputer), 5 mata kuliah (IK501–IK505), 10 ruangan
(GDS-506..515, masing-masing dengan koordinat + radius 50 m), 5 jadwal (Senin–
Jumat 08:00–10:30, dibagi antara dua dosen), 15 pendaftaran (semua mahasiswa
di semua mata kuliah).

---

## 3. Menyiapkan Environment Demo

```bash
# 1. Install dependensi
pnpm install

# 2. Tarik env branch Neon (butuh link .neon + login neonctl)
npx neon@latest env pull .env.local

# 3. (Opsional) Reset total data demo — HAPUS semua tabel app + auth users
node --env-file=.env.local scripts/reset-demo.mjs

# 4. Buat 6 akun auth + mapping ke public.users
node --env-file=.env.local scripts/auth-users.mjs

# 5. Seed mata kuliah, ruangan, jadwal, pendaftaran
node scripts/seed.mjs

# 6. Jalankan frontend (talks to the deployed Neon backend)
pnpm dev            # http://localhost:5173
```

Backend API sudah ter-deploy di Neon Function dan tidak perlu dijalankan
lokal untuk demo. Jika butuh redeploy:

```bash
npx neon@latest deploy --env .env.local -y
```

### Mode Demo (opsional tapi disarankan)

Set `KLAS_DEMO_MODE=true` di `.env.local` lalu redeploy — endpoint destruktif
(delete mahasiswa/dosen/mata kuliah/jadwal/ruangan/prodi, unenroll,
delete-session) akan menolak dengan 403, sehingga audiens tidak bisa
menghapus data seed. Create dan edit tetap aktif.

---

## 4. Alur Demo yang Disarankan (15 menit)

### 4.1 Admin — persiapan kelas (4 menit)

Login sebagai `admin@klas.unj.ac.id`.

1. **Dashboard** — tunjukkan KPI (sesi aktif hari ini, tingkat kehadiran,
   pelanggaran geofence, total mahasiswa), grafik tren, dan System Overview.
2. **Master Data** — buka tab Students/Lecturers/Courses; tunjukkan pencarian
   dan filter. (Bisa tambah data baru untuk membuktikan CRUD jalan.)
3. **Schedule Plotting** — tunjukkan ringkasan alokasi, dropdown dosen dan
   ruangan per jadwal (assign langsung dari tabel).
4. **Audit Logs** — catatan setiap aksi tadi sudah masuk di sini.

### 4.2 Dosen — membuka sesi & monitoring live (6 menit)

Login sebagai `budi.santoso@unj.ac.id` di perangkat kedua (laptop/proyektor).

1. **Dashboard dosen** — kartu mata kuliah hari ini (lihat hari aktual;
   Senin = IK501, Selasa = IK502, dst).
2. **Open Session** — sesi terbuka, QR besar tampil dan otomatis ber-rotate
   tiap 15 detik. Tunjukkan **Session Settings**: radius geofence dan interval
   rotasi QR (slider, step 5).
3. **Live Activity Log** — panel kanan; check-in mahasiswa muncul sendiri
   (Neon Realtime, tanpa refresh).

### 4.3 Mahasiswa — check-in (3 menit)

Login sebagai `ahmad.fauzi@mhs.unj.ac.id` di HP.

1. **Home** — kartu kelas hari ini dengan status (Upcoming/In-session/Closed).
2. **SCAN QR** — buka scanner, izinkan kamera + lokasi, arahkan ke QR di
   layar dosen. Hasil: sukses (animasi) atau pesan error yang jelas.
3. **Logs** — riwayat kehadiran; baris baru (mis. `late` karena di luar
   geofence) langsung terlihat.
4. **Profile** — data mahasiswa, IPK, dosen pembimbing.

### 4.4 Tutup lingkaran (2 menit)

1. Di layar dosen: **Live Activity Log** sudah menampilkan mahasiswa tadi
   (realtime). Tunjukkan **Manual Correction** untuk mengubah status
   (present/late/absent/excused) dan **Sessions** untuk riwayat sesi.
2. Di admin: **Global Attendance** → pilih mata kuliah → bukti data
   lintas-role konsisten.
3. **End Session** dari layar dosen untuk menutup demo rapi.

---

## 5. Poin Teknis yang Layak Diceritakan

- **Satu Neon Function menggantikan 37 edge function** — route name sama
  persis dengan kontrak lama (`neon-api/CONTRACT.md`), sehingga frontend
  hanya berganti base URL.
- **Auth = Neon Auth (Managed Better Auth)** — JWT EdDSA diverifikasi
  server-side via JWKS; `public.users.user_id` = id user Neon Auth.
- **Realtime** — dosen/admin berlangganan *sealed live query* (kapabilitas
  terenkripsi yang diterbitkan API) sehingga tabel check-in diperbarui tanpa
  polling.
- **QR anti-palsu** — payload terenkripsi AES-GCM dengan `QR_SECRET`; token
  kedaluwarsa/keeled per sesi; `generate-qr-token` mengembalikan batch agar
  rotasi di klien drift-compensated.
- **Audit trail** — setiap aksi tulis tercatat di `audit_log` (kategori,
  aksi, IP, status), tampil di halaman Audit Logs.
- **Cron** — `cron:klas-maintenance` tiap 5 menit menutup sesi stale dan
  menghapus QR kedaluwarsa.
- **Demo mode** — `KLAS_DEMO_MODE=true` mematikan endpoint destruktif
  (lihat §3).

---

## 6. Troubleshooting Demo

| Gejala | Penyebab & solusi |
| --- | --- |
| Login gagal `Invalid origin` | Origin frontend belum jadi trusted domain: `npx neonctl@latest neon-auth domain add <origin> --project-id rapid-mountain-36241244 --branch production` |
| API call gagal CORS | `KLAS_CORS_ORIGINS` belum memuat origin frontend; update env lalu redeploy |
| QR tidak muncul / sesi tidak live | Sesi belum dibuka — tekan **Open Session**; cek status kartu mata kuliah |
| Check-in selalu `late` | Jarak > radius ruangan atau IP di luar whitelist — ini perilaku desain (flag, bukan blok) |
| Data demo kacau setelah audiens iseng | Jalankan ulang §3 langkah 3–5 (reset + reseed) |
| Scanner kamera error di laptop | Browser butuh kamera; gunakan HP untuk scan atau izinkan kamera di browser |

---

## 7. Tautan

- Frontend (produksi): <https://klas-demo.vercel.app>
- API: `https://br-wild-unit-azq7a8bc-api.compute.c-3.ap-southeast-1.aws.neon.tech`
- Kontrak API: [`neon-api/CONTRACT.md`](../neon-api/CONTRACT.md)
- Arsitektur backend: [`docs/architecture/neon.md`](architecture/neon.md)
- Daftar fitur per halaman: [`docs/features.md`](features.md)
