# KLAS — Geospatial Presence Verification System

![KLAS logo](/public/logo.svg)

KLAS is a web-based student attendance verification system designed to replace conventional, manual attendance methods with a secure, automated, and tamper-proof verification mechanism.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the development server with auto-restart on file changes
pnpm dev
```

## Overview

The system leverages:

- **Dynamic QR Code Scanning**: Time-limited, auto-regenerating QR codes with a 15-second TTL.
- **GPS Geofencing**: Computes great-circle distance server-side using PostGIS/geography to verify the student is within the classroom boundary.
- **Campus Network IP Filtering**: Validates request origin against whitelisted campus Wi-Fi subnets using bitwise CIDR block matching.

---

## 🛠️ Technology Stack

- **Frontend**: React 19 + React Router v8 + Vite 8 + Tailwind v4
- **Backend**: Neon (PostgreSQL + PostGIS + Functions + Auth + Realtime + Object Storage)

---

## 📂 Project Structure

```text
klas/
├── app/
│   ├── lib/                  # Shared utilities
│   │   ├── api.ts            # Frontend API client (Neon Function calls)
│   │   ├── auth.ts           # Neon Auth client + JWT bearer helper
│   │   ├── realtime.ts       # Neon Realtime live-query hooks
│   │   ├── types.ts          # TypeScript type definitions
│   │   └── utils.ts          # Shared utilities
│   ├── routes/               # Application routing by role
│   │   ├── admin/            # Administrative management portals
│   │   ├── dosen/            # Lecturer controls & real-time analytics
│   │   └── mahasiswa/        # Student interface
│   └── root.tsx              # React entrypoint
├── neon-api/                 # Neon Function `api` — Hono app
│   ├── index.ts              # Route mounts, CORS, error envelope
│   ├── cron.ts               # Scheduled maintenance handler
│   ├── CONTRACT.md           # Endpoint contract
│   ├── lib/                  # env, db, auth, qr, geo, audit, storage
│   └── routes/               # auth, attendance, dosen, admin, realtime
├── neon/
│   └── sql/001_functions.sql # Schema reconciliation + SQL helpers
├── neon.ts                   # Neon IaC: auth, functions, buckets, realtime, triggers
├── supabase/                 # Canonical SQL migrations (schema source)
│   ├── migrations/           # 001..004 schema, 006..009 Supabase-only extras
│   └── seed.sql              # Non-auth seed data
├── scripts/                  # db runner, auth users, seed, smoke test
├── public/                   # Static assets (including logo.svg)
├── tests/                    # Test suite
├── docs/                     # Project documentation
├── package.json              # Development scripts & dependencies
```

---

## ⚙️ Development Setup & Commands

### Prerequisites

- Node.js 20+ installed on your machine
- pnpm (the project uses `pnpm-lock.yaml`)
- A Neon project linked locally (`.neon`); `npx neon env pull .env.local` writes the branch secrets

### Core Frontend Commands

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `pnpm dev`         | Start development server (React Router dev, not Vite) |
| `pnpm dev:tunnel`  | Start with `--host` for Cloudflare tunnel             |
| `pnpm build`       | Production build for deployment                       |
| `pnpm start`       | Run production server                                 |
| `pnpm typecheck`   | TypeScript type checking (react-router typegen + tsc) |
| `pnpm test`        | Run Vitest test suite                                 |
| `pnpm test:watch`  | Run Vitest in watch mode                              |

### Neon Backend

```bash
# Apply schema + SQL helpers, create Neon Auth users, seed demo data
pnpm db:setup

# Bundle + deploy the api and cron functions and apply triggers
pnpm neon:deploy

# End-to-end checks against the deployed function
pnpm smoke
```

`npx neon config plan --env .env.local` shows what a deploy would change;
`npx neon dev` serves the Hono app locally with the branch's env injected.

### Database

- Schema: `supabase/migrations/001..004` (canonical) plus `neon/sql/001_functions.sql`
- Seed data: `supabase/seed.sql` and `scripts/seed.mjs`
- Auth users: `scripts/auth-users.mjs` (Neon Auth Admin API)

---

## 🔒 Backend Architecture

### Authentication

- Sign-in, session refresh and password changes use Neon Auth (`@neon/auth`, Managed Better Auth).
- The browser sends the 15-minute EdDSA JWT as `Authorization: Bearer <JWT>`; the Function verifies it against the branch JWKS and loads the profile from `public.users`.
- `POST /refresh-session` accepts the signed session cookie in the body or the `Cookie` header and rejects a cookie that does not match the refresh token.

### Security Model

- **All HTTP operations** flow through one Neon Function (`api`), a Hono app in `neon-api/`.
- Paths keep the old edge-function names (`POST <VITE_NEON_API_URL>/<name>`), so `app/lib/api.ts` is unchanged.
- **No RLS**: role checks live in `neon-api/lib/auth.ts` and each route.
- Errors keep the old envelope: `{ "error": "<message>" }`.

### Endpoints

`neon-api/CONTRACT.md` is the source of truth. It covers the 37 former edge functions plus `/realtime/config`, `/realtime/presensi`, `/realtime/sesi` and `/realtime/notifikasi`:

- **Auth**: `login`, `refresh-session`, `change-password`, `provision-user`
- **Check-in & sessions**: `check-in`, `generate-qr-token`, `open-session`, `close-session`, `reopen-session`, `update-session`, `update-session-settings`, `delete-session`, `list-sessions`, `get-live-session`
- **Attendance**: `correct-attendance`, `bulk-mark-present`, `get-course-students`
- **Profiles & dashboards**: `get-my-profile`, `get-my-dashboard`, `get-my-logs`, `get-dosen-profile`, `update-dosen-profile`, `get-dosen-dashboard`, `get-admin-dashboard`
- **Reporting**: `get-dosen-report`, `export-report`, `get-attendance-stats`, `get-global-attendance`, `get-admin-attendance-courses`
- **Admin CRUD**: `crud-mahasiswa`, `crud-dosen`, `crud-mata-kuliah`, `crud-jadwal`, `crud-ruangan`, `crud-prodi`
- **Support**: `get-notifications`, `get-audit-logs`

### Scheduled Jobs

`neon-api/cron.ts` runs `auto_close_stale_sessions()` and `cleanup_expired_qr_codes()` (see `neon/sql/001_functions.sql`). The `klas-maintenance` trigger in `neon.ts` invokes it every 5 minutes (UTC); calls without Neon's `X-Neon-Trigger-Invocation-Id` header are rejected.

---

## 📊 Testing

### Setup

Tests use:

- **Framework**: Vitest with `happy-dom` environment
- **Setup**: `tests/setup.ts` imports `@testing-library/jest-dom/vitest`
- **Helpers**: `tests/helpers.tsx` provides `renderWithRouter()` for route-aware rendering
- **Mocking**: Mock `app/lib/api.ts` for Function calls, `app/lib/auth.ts` for sign-in, and `app/components/Toast` for notifications

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (auto-rerun on changes)
pnpm test:watch
```

### Existing Test Coverage

- `tests/dosen/dashboard.test.tsx` - Lecturer dashboard functionality
- `tests/attendance.test.tsx` - Attendance management tests
- `tests/correction.test.tsx` - Attendance correction workflows
- `tests/sessions.test.tsx` - Session management tests

---

## ⚡ Realtime Features

The application uses Neon Realtime sealed live queries over WebSockets:

- `useRealtimePresensi`: Attendance updates in real-time
- `useRealtimeSession`: Session status changes
- `useRealtimeNotifikasi`: Notification system
- `useSessionBroadcast`: Session progress broadcasting

---

## 🛡️ Configuration

### Environment Variables

Create `.env.local` (gitignored) from `npx neon env pull .env.local`, then set the browser-facing values:

```bash
VITE_NEON_AUTH_URL=https://<endpoint>.neonauth.<cell>.<region>.aws.neon.tech/neondb/auth
VITE_NEON_API_URL=https://<branch-id>-api.compute.<cell>.<region>.aws.neon.tech
VITE_NEON_REALTIME_URL=wss://<realtime-endpoint>

# Function secrets declared in neon.ts
QR_SECRET=change-me-at-least-32-characters-long
KLAS_CORS_ORIGINS=https://klas.unj.ac.id,http://localhost:5173
KLAS_REPORT_BUCKET=assets
```

See `.env.example` for the full list, including the server-side `DATABASE_URL`,
`NEON_AUTH_*`, `NEON_REALTIME_*` and `AWS_*` variables.

### Vite Configuration

`vite.config.ts` includes:

- React Router integration
- Tailwind CSS v4
- Basic SSL for development
- Host forwarding for tunneling

### React Router Configuration

`react-router.config.ts` runs in SPA mode (`ssr: false`). Every route loads its
data in a `clientLoader` and no loader touches the server, so the production
build is the static `build/client` folder served by Vercel. Set `ssr: true` to
render on a Node server with `pnpm start` instead.

---

## 🚀 Deployment (Vercel)

The frontend is a static SPA on Vercel; the API, auth, realtime service and
database live in Neon (`ap-southeast-1`).

1. **Deploy the Neon functions** so the browser has an API to call:

   ```bash
   npx neon deploy --env .env.local --yes
   npx neon functions list          # `api` and `cron` should be `completed`
   pnpm smoke                      # end-to-end checks against the deployed API
   ```

2. **Import the repository on Vercel** (`vercel.com/new`) with:
   - Framework preset: **Vite** (already pinned in `vercel.json`)
   - Build command: `pnpm build`, output directory: `build/client`
   - Node.js version: 22 (`22.x`, from `.nvmrc`)
   - Region: **Singapore (sin1)**, same region as the Neon branch
   - Environment variables (Production and Preview):

     ```bash
     VITE_NEON_AUTH_URL=https://ep-winter-hat-az4t5c3x.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth
     VITE_NEON_API_URL=https://br-wild-unit-azq7a8bc-api.compute.c-3.ap-southeast-1.aws.neon.tech
     VITE_NEON_REALTIME_URL=wss://ep-winter-hat-az4t5c3x.rt.c-3.ap-southeast-1.aws.neon.tech/
     ```

     `VITE_*` values are inlined at build time: change one and redeploy.

3. **Allow the new origin** in both places, or sign-in and API calls fail:
   - CORS: add the Vercel origin to `KLAS_CORS_ORIGINS` in `.env.local`, then
     redeploy the function (`npx neon deploy --env .env.local --yes`). Matching
     is exact, so list each origin, including preview URLs you want to test.
   - Neon Auth trusted domains:
     `npx neon neon-auth domain add https://<project>.vercel.app --branch production`
     (plus `https://<project>-*.vercel.app` for preview deployments).

4. **Verify** the deployed URL: landing page, sign-in, dashboard, scanner, and
   `pnpm smoke` for the API.

Neon Auth sets its session cookie with `SameSite=None; Partitioned`, so Safari
and some in-app browsers may drop it. The workaround is proxying
`/api/auth/*` to Neon Auth through a Vercel rewrite and pointing
`VITE_NEON_AUTH_URL` at the same origin.

---

## 🔗 Additional Resources

- **React Router**: https://reactrouter.com/
- **Vite**: https://vite.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **Neon**: https://neon.com/docs/

---

_Last updated: 2026-11-13_
