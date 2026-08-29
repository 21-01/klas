# Project Directory Structure

```
klas-frontend/
├── .dockerignore
├── .env
├── .env.example
├── .gitignore
├── AGENTS.md
├── Dockerfile
├── README.md
├── package.json
├── package-lock.json
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
│   │   └── TopAppBar.tsx               # Mobile top app bar
│   │
│   ├── lib/
│   │   ├── api.ts                       # supabase.functions.invoke wrappers
│   │   ├── realtime.ts                  # useRealtimePresensi, useRealtimeSession, etc.
│   │   ├── supabase.ts                  # Supabase client singleton
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
│       │   ├── layout.tsx              # Dosen layout shell (desktop header)
│       │   ├── dashboard.tsx           # Dosen dashboard
│       │   ├── attendance-index.tsx    # Course selection for attendance
│       │   ├── attendance.tsx          # Live QR monitor + session control
│       │   ├── sessions.tsx            # Session history list
│       │   ├── correction.tsx          # Manual attendance correction
│       │   ├── report.tsx              # Academic report per course
│       │   └── account-settings.tsx    # Password change
│       │
│       └── admin/
│           ├── layout.tsx              # Admin layout shell (desktop sidebar)
│           ├── dashboard.tsx           # Admin analytics dashboard
│           ├── master-data.tsx         # CRUD for prodi, dosen, mahasiswa, mk, ruangan
│           ├── schedule.tsx            # Jadwal management + plotting
│           ├── attendance.tsx          # Global attendance view
│           ├── audit-logs.tsx          # Audit log viewer + CSV export
│           └── settings.tsx            # System settings (geofence, QR rotation, roles)
│
├── docs/
│   ├── directory-structure.md           # This file
│   ├── backend-implementation-plan.md
│   ├── backend.md
│   ├── database-schema.md
│   ├── edge-functions.md
│   ├── features.md
│   ├── frontend.md
│   ├── product-requirement.md
│   ├── session-management-plan.md
│   ├── style-design.md
│   └── laporan/                         # Lab reports
│       ├── laporan-3-perancangan-database-auth.md
│       ├── laporan-4-frontend.md
│       ├── laporan-5-frontend.md
│       └── laporan-6-frontend.md
│
├── public/
│   ├── favicon.ico
│   └── logo.svg
│
├── supabase/
│   ├── config.toml                      # Supabase local dev config
│   ├── seed.sql                         # Non-auth seed data
│   │
│   ├── functions/
│   │   ├── _shared/                     # Shared utilities (all functions import from here)
│   │   │   ├── cors.ts                  # CORS headers + handleCors()
│   │   │   ├── crypto.ts               # QR token generation
│   │   │   ├── geofence.ts             # Haversine distance + geofence check
│   │   │   ├── supabase.ts             # getAdminClient(), extractJwt(), getClientIp()
│   │   │   ├── types.ts               # Shared Deno types
│   │   │   └── zod-schemas.ts          # Shared Zod schemas (login, checkIn, etc.)
│   │   │
│   │   ├── auth/
│   │   │   ├── login/                   # POST /login — email+password auth
│   │   │   ├── refresh-session/         # POST /refresh-session — token refresh
│   │   │   ├── change-password/         # POST /change-password
│   │   │   └── provision-user/          # POST /provision-user — admin creates users
│   │   │
│   │   ├── mahasiswa/
│   │   │   ├── get-my-profile/          # GET mahasiswa profile
│   │   │   ├── get-my-dashboard/        # GET mahasiswa dashboard stats
│   │   │   ├── get-my-logs/             # GET attendance logs (paginated)
│   │   │   ├── get-attendance-stats/    # GET attendance breakdown
│   │   │   └── check-in/               # POST check-in with QR + geofence
│   │   │
│   │   ├── dosen/
│   │   │   ├── get-dosen-dashboard/     # GET dosen dashboard stats
│   │   │   ├── get-dosen-profile/       # GET dosen profile
│   │   │   ├── update-dosen-profile/    # POST update dosen profile
│   │   │   ├── get-course-students/     # GET enrolled students for a jadwal
│   │   │   ├── get-dosen-report/        # GET attendance report per course
│   │   │   ├── export-report/           # POST export report as CSV
│   │   │   ├── open-session/            # POST open attendance session
│   │   │   ├── close-session/           # POST close session + compute absent
│   │   │   ├── get-live-session/        # GET live session status
│   │   │   ├── generate-qr-token/       # POST generate new QR token
│   │   │   ├── correct-attendance/      # POST manual attendance correction
│   │   │   ├── bulk-mark-present/       # POST bulk mark students present
│   │   │   ├── list-sessions/           # GET list all sessions (with filters)
│   │   │   ├── update-session/          # POST update session details
│   │   │   ├── update-session-settings/ # POST update geofence/QR settings
│   │   │   ├── delete-session/          # POST delete a session
│   │   │   └── reopen-session/          # POST reopen a closed session
│   │   │
│   │   └── admin/
│   │       ├── get-admin-dashboard/     # GET admin analytics (12+ metrics)
│   │       ├── get-global-attendance/   # GET global attendance view
│   │       ├── get-audit-logs/          # GET audit logs (paginated + CSV)
│   │       ├── get-notifications/       # POST list/mark-read/stats
│   │       ├── crud-mahasiswa/          # POST CRUD mahasiswa (list/get/create/update/delete)
│   │       ├── crud-dosen/              # POST CRUD dosen
│   │       ├── crud-mata-kuliah/        # POST CRUD mata kuliah
│   │       ├── crud-jadwal/             # POST CRUD jadwal + assign dosen/ruangan
│   │       ├── crud-ruangan/            # POST CRUD ruangan
│   │       ├── crud-prodi/              # POST CRUD program studi
│   │       ├── update-settings/         # POST update system settings
│   │       └── update-role-permissions/ # POST update role permissions
│   │
│   ├── migrations/
│   │   ├── 001_core.sql                 # program_studi, users, mahasiswa, dosen
│   │   ├── 002_academic.sql             # mata_kuliah, ruangan, jadwal_kelas, pendaftaran_kelas
│   │   ├── 003_attendance.sql           # sesi_kehadiran, presensi, koreksi_presensi
│   │   ├── 004_security.sql             # audit_log, notifikasi, role_permissions, etc.
│   │   ├── 006_rls.sql                  # Row Level Security policies
│   │   ├── 007_realtime.sql             # Realtime publication config
│   │   ├── 008_scheduled_tasks.sql      # pg_cron scheduled jobs
│   │   └── 009_seed_users.sql           # Auth user seeding via SQL
│   │
│   └── scripts/
│       └── create-auth-users.ps1        # PowerShell script to create auth users via Admin API
│
├── tests/
│   ├── setup.ts                         # Vitest setup (imports jest-dom/vitest)
│   ├── helpers.tsx                      # renderWithRouter(), mockCourses, mockLiveSession
│   │
│   ├── public/
│   │   ├── home.test.tsx
│   │   └── login.test.tsx
│   │
│   ├── components/
│   │   ├── classcard.test.tsx
│   │   ├── statuspill.test.tsx
│   │   └── toast.test.tsx
│   │
│   ├── mahasiswa/
│   │   ├── dashboard.test.tsx
│   │   ├── logs.test.tsx
│   │   └── profile.test.tsx
│   │
│   ├── dosen/
│   │   ├── dashboard.test.tsx
│   │   ├── attendance.test.tsx
│   │   ├── correction.test.tsx
│   │   ├── report.test.tsx
│   │   └── sessions.test.tsx
│   │
│   └── admin/
│       ├── dashboard.test.tsx
│       ├── master-data.test.tsx
│       └── audit-logs.test.tsx
│
└── testing/
    ├── KLAS-API-Testing.postman_collection.json   # 60+ integration test requests
    └── klas-local.postman_environment.json         # Local Supabase environment vars
```

## Key Counts

| Directory | Count | Description |
|-----------|-------|-------------|
| `app/routes/` | 22 files | 7 top-level + 7 dosen + 8 admin |
| `app/components/` | 5 files | Shared UI components |
| `app/lib/` | 5 files | API client, Supabase, realtime, types, utils |
| `supabase/functions/` | 38 functions | 6 auth + 5 mahasiswa + 16 dosen + 12 admin |
| `supabase/functions/_shared/` | 6 files | Shared Deno utilities |
| `supabase/migrations/` | 8 files | Database schema migrations |
| `tests/` | 16 test files | 109 unit tests across 5 categories |
| `docs/` | 10 files | Project documentation + 4 lab reports |

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (SSR)                     │
│  React 19 + React Router v8 + Vite 8 + Tailwind v4  │
│  app/routes/ → app/lib/api.ts → Supabase Edge Fn     │
└────────────────────────┬────────────────────────────┘
                         │ invoke()
┌────────────────────────▼────────────────────────────┐
│              Supabase Edge Functions (Deno)           │
│  38 functions in supabase/functions/                  │
│  Auth → Mahasiswa → Dosen → Admin                    │
│  All use _shared/ (cors, supabase, zod, geofence)    │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Supabase PostgreSQL + Auth               │
│  8 migrations in supabase/migrations/                 │
│  14 tables with RLS + Realtime                       │
└─────────────────────────────────────────────────────┘
```
