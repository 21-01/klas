# Project Directory Structure

```text
klas/
├── .env.example                         # Neon/Auth/Storage/Function env template
├── .gitignore
├── .neon                                # Local Neon project + branch link
├── README.md
├── neon.ts                              # Neon IaC: auth, functions, buckets, realtime, triggers
├── package.json
├── pnpm-lock.yaml
├── react-router.config.ts
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
│
├── app/
│   ├── app.css                          # Tailwind v4 @theme design tokens
│   ├── root.tsx                         # HTML shell, fonts, Toast provider
│   ├── routes.ts                        # Route config (index, layout, route helpers)
│   │
│   ├── components/
│   │   ├── ClassCard.tsx                # Reusable class/session card
│   │   ├── ClickAwayListener.tsx        # Outside-click detection wrapper
│   │   ├── StatusPill.tsx               # Status badge (present/absent/late/etc)
│   │   ├── Toast.tsx                    # Toast notification system
│   │   └── TopAppBar.tsx                # Mobile top app bar
│   │
│   ├── lib/
│   │   ├── api.ts                       # invoke() wrappers over VITE_NEON_API_URL
│   │   ├── auth.ts                      # @neon/auth client + getAccessToken()
│   │   ├── realtime.ts                  # Neon Realtime live-query hooks
│   │   ├── types.ts                     # Shared TypeScript types
│   │   └── utils.ts                     # cn() helper (clsx + tailwind-merge)
│   │
│   └── routes/
│       ├── home.tsx                     # Landing page (public)
│       ├── login.tsx                    # Login page (public)
│       ├── layout.tsx                   # Mahasiswa layout shell
│       ├── dashboard.tsx                # Mahasiswa dashboard
│       ├── logs.tsx                     # Mahasiswa attendance logs
│       ├── profile.tsx                  # Mahasiswa profile
│       ├── scanner.tsx                  # QR code scanner
│       │
│       ├── dosen/
│       │   ├── layout.tsx               # Dosen layout shell (desktop header)
│       │   ├── dashboard.tsx            # Dosen dashboard
│       │   ├── attendance-index.tsx     # Course selection for attendance
│       │   ├── attendance.tsx           # Live QR monitor + session control
│       │   ├── sessions.tsx             # Session history list
│       │   ├── correction.tsx           # Manual attendance correction
│       │   ├── report.tsx               # Academic report per course
│       │   └── account-settings.tsx     # Password change
│       │
│       └── admin/
│           ├── layout.tsx               # Admin layout shell (desktop sidebar)
│           ├── dashboard.tsx            # Admin analytics dashboard
│           ├── master-data.tsx          # CRUD for prodi, dosen, mahasiswa, mk, ruangan
│           ├── schedule.tsx             # Jadwal management + plotting
│           ├── attendance.tsx           # Global attendance view
│           ├── audit-logs.tsx           # Audit log viewer + CSV export
│           └── settings.tsx             # System settings (geofence, QR rotation, roles)
│
├── neon-api/                            # Neon Function `api` (Hono)
│   ├── index.ts                         # CORS, error envelope, route mounts
│   ├── cron.ts                          # Scheduled maintenance handler
│   ├── CONTRACT.md                      # Endpoint contract
│   ├── lib/
│   │   ├── auth.ts                      # JWT verification + role checks
│   │   ├── db.ts                        # pg Pool + attachDatabasePool
│   │   ├── env.ts                       # Runtime configuration
│   │   ├── http.ts                      # HttpError, envelopes, CORS
│   │   ├── neon-auth.ts                 # Better Auth client helpers
│   │   ├── qr.ts                        # Signed QR payloads
│   │   ├── geo.ts                       # Haversine + CIDR matching
│   │   ├── storage.ts                   # SigV4 uploader for Neon Object Storage
│   │   ├── audit.ts                     # audit_log writer
│   │   └── util.ts                      # Pagination, CSV, Jakarta dates
│   └── routes/
│       ├── auth.ts                      # login, refresh, profile, dashboards
│       ├── attendance.ts                # check-in, sessions, QR, reports
│       ├── dosen.ts                     # lecturer profile, sessions, export
│       ├── admin.ts                     # dashboards, CRUD, audit, settings
│       └── realtime.ts                  # live-query capabilities
│
├── neon/
│   └── sql/001_functions.sql            # Schema reconciliation + SQL helpers
│
├── supabase/                            # Canonical SQL (schema source only)
│   ├── config.toml                      # Legacy local config (unused)
│   ├── migrations/
│   │   ├── 001_core.sql                 # program_studi, users, mahasiswa, dosen
│   │   ├── 002_academic.sql             # mata_kuliah, ruangan, jadwal_kelas, pendaftaran_kelas
│   │   ├── 003_attendance.sql           # sesi_kehadiran, presensi, koreksi_presensi
│   │   ├── 004_security.sql             # audit_log, notifikasi, role_permissions, etc.
│   │   ├── 006_rls.sql                  # RLS policies (not applied on Neon)
│   │   ├── 007_realtime.sql             # Supabase publication (not applied on Neon)
│   │   ├── 008_scheduled_tasks.sql      # pg_cron jobs (replaced by cron.ts)
│   │   └── 009_seed_users.sql           # Auth user seeding
│   ├── functions/                       # Legacy edge functions (retired)
│   └── seed.sql                         # Non-auth seed data
│
├── scripts/
│   ├── db.mjs                           # SQL runner (probe / file)
│   ├── auth-users.mjs                   # Neon Auth user provisioning
│   ├── seed.mjs                         # Demo academic data
│   ├── probe-auth.mjs                   # Auth endpoint probe
│   └── smoke.mjs                        # End-to-end acceptance checks
│
├── docs/
│   ├── architecture/
│   │   ├── neon.md                      # Neon backend map and operations
│   │   ├── database-schema.md
│   │   ├── directory-structure.md       # This file
│   │   ├── edge-functions.md            # Pointer to neon-api/CONTRACT.md
│   │   └── session-management-plan.md
│   ├── backend.md
│   ├── features.md
│   ├── frontend.md
│   ├── product-requirement.md
│   └── style-design.md
│
├── postman/
│   ├── KLAS-API-Testing.postman_collection.json
│   └── klas-local.postman_environment.json
│
├── public/
│   ├── favicon.ico
│   └── logo.svg
│
└── tests/
    ├── setup.ts                         # Vitest setup (imports jest-dom/vitest)
    ├── helpers.tsx                      # renderWithRouter(), mockCourses, mockLiveSession
    │
    ├── public/
    │   ├── home.test.tsx
    │   └── login.test.tsx
    │
    ├── components/
    │   ├── classcard.test.tsx
    │   ├── statuspill.test.tsx
    │   └── toast.test.tsx
    │
    ├── mahasiswa/
    │   ├── dashboard.test.tsx
    │   ├── logs.test.tsx
    │   └── profile.test.tsx
    │
    ├── dosen/
    │   ├── dashboard.test.tsx
    │   ├── attendance.test.tsx
    │   ├── correction.test.tsx
    │   ├── report.test.tsx
    │   └── sessions.test.tsx
    │
    └── admin/
        ├── dashboard.test.tsx
        ├── master-data.test.tsx
        └── audit-logs.test.tsx
```

## Key Counts

| Directory | Count | Description |
|-----------|-------|-------------|
| `app/routes/` | 22 files | 7 top-level + 7 dosen + 8 admin |
| `app/components/` | 5 files | Shared UI components |
| `app/lib/` | 5 files | API client, auth, realtime, types, utils |
| `neon-api/routes/` | 5 files | auth, attendance, dosen, admin, realtime |
| `neon-api/` | 1 Function + 1 scheduled Function | `api` (Hono) and `cron` |
| `neon/sql/` | 1 file | SQL helpers applied after the canonical schema |
| `supabase/migrations/` | 8 files | Canonical schema; 006–008 are Supabase-only |
| `tests/` | 16 test files | 109 unit tests across 5 categories |
| `docs/` | 10 files | Project documentation |

## Architecture Summary

```text
┌──────────────────────────────────────────────────────┐
│                    Frontend (SSR)                     │
│  React 19 + React Router v8 + Vite 8 + Tailwind v4   │
│  app/routes/ → app/lib/api.ts → POST /<endpoint>      │
└────────────────────────┬─────────────────────────────┘
                         │ bearer JWT
┌────────────────────────▼─────────────────────────────┐
│              Neon Function `api` (Hono)              │
│  neon-api/index.ts → routes/{auth,attendance,dosen,  │
│  admin,realtime}.ts · authorization in lib/auth.ts    │
└────────────────────────┬─────────────────────────────┘
                         │ pg
┌────────────────────────▼─────────────────────────────┐
│         Neon Postgres (branch `production`)          │
│  supabase/migrations/001..004 + neon/sql/001         │
│  PostGIS · no RLS (API enforces roles)               │
└──────────────────────────────────────────────────────┘

Neon Auth (Better Auth)  ·  Neon Realtime (live queries)
Neon Object Storage (`assets`)  ·  Function Trigger `klas-maintenance`
```
