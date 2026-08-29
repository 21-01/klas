# KLAS — Geospatial Presence Verification System

![KLAS logo](/public/logo.svg)

KLAS is a web-based student attendance verification system designed to replace conventional, manual attendance methods with a secure, automated, and tamper-proof verification mechanism.

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server with auto-restart on file changes
npm run dev
```

## Overview

The system leverages:

- **Dynamic QR Code Scanning**: Time-limited, auto-regenerating QR codes with a 15-second TTL.
- **GPS Geofencing**: Computes great-circle distance server-side using PostGIS/geography to verify the student is within the classroom boundary.
- **Campus Network IP Filtering**: Validates request origin against whitelisted campus Wi-Fi subnets using bitwise CIDR block matching.

---

## 🛠️ Technology Stack

- **Frontend**: React 19 + React Router v8 + Vite 8 + Tailwind v4
- **Backend**: Supabase (PostgreSQL + PostGIS + Edge Functions + Realtime)

---

## 📂 Project Structure

```text
klas-frontend/
├── app/
│   ├── lib/                  # Shared utilities
│   │   ├── api.ts            # Frontend API client
│   │   ├── realtime.ts       # Supabase Realtime hooks
│   │   ├── supabase.ts       # Supabase client configuration
│   │   ├── types.ts          # TypeScript type definitions
│   │   └── utils.ts           # Shared utilities
│   ├── routes/               # Application routing by role
│   │   ├── admin/            # Administrative management portals
│   │   ├── dosen/            # Lecturer controls & real-time analytics
│   │   └── mahasiswa/         # Student interface
│   └── root.tsx              # React entrypoint
├── supabase/
│   ├── config.toml           # Local configuration
│   ├── functions/            # Edge Functions (37 total)
│   │   ├── _shared          # Shared utilities
│   │   ├── [function-name]   # Function implementations
│   ├── migrations/           # Database schema migrations
│   ├── scripts/              # Auth user provisioning script
│   └── seed.sql              # Initial data seed
├── public/                   # Static assets (including logo.svg)
├── tests/                    # Test suite
├── docs/                     # Project documentation
├── package.json              # Development scripts & dependencies
```

---

## ⚙️ Development Setup & Commands

### Prerequisites

- Node.js 20+ installed on your machine
- Supabase CLI installed (`npx supabase --version`)

### Core Frontend Commands

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Start development server (React Router dev, not Vite) |
| `npm run dev:tunnel` | Start with `--host` for Cloudflare tunnel             |
| `npm run build`      | Production build for deployment                       |
| `npm run start`      | Run production server                                 |
| `npm run typecheck`  | TypeScript type checking (react-router typegen + tsc) |
| `npm run test`       | Run Vitest test suite                                 |
| `npm run test:watch` | Run Vitest in watch mode                              |

### Supabase Local Development

```bash
# Start local Supabase emulator stack (ports: 54321 API, 54322 DB, 54323 Studio)
supabase start

# Stop local stack
supabase stop

# Reset database (migrations + seed)
supabase db reset

# Run Edge Functions locally for testing
supabase functions serve

# Deploy function changes
supabase functions deploy <function-name>

# Push migrations to remote database
supabase db push

# Pull remote changes to local
supabase db pull
```

### Database

- Schema: `supabase/migrations/`
- Seed data: `supabase/seed.sql`
- Auth users: `supabase/scripts/create-auth-users.ps1 -Local`

---

## 🔒 Edge Functions Architecture

### Authentication

- Custom auth: `login` edge function handles login, returns `{session: {access_token, refresh_token}, user}`
- Session tokens managed client-side (not via `supabase-js signIn`)

### Security Model

- **All HTTP operations** flow through Supabase Edge Functions
- **JWT verification**: Most functions have `verify_jwt = true`, only `login`, `refresh-session`, `get-notifications` have `verify_jwt = false`
- **RLS** enforced on `presensi`, `jadwal_kelas`, `parameter_keamanan` tables

### Core Functions

The application uses **37 Edge Functions** for all business logic:

#### Check-in & Session Management

- `check-in`: Verifies student location, QR token, and network
- `generate-qr-token`: Creates 15-second QR codes for lecturers
- `open-session`, `close-session`, `refresh-session`, `reopen-session`: Session lifecycle
- `get-live-session`, `update-session`, `update-session-settings`, `delete-session`, `list-sessions`

#### Attendance Operations

- `correct-attendance`: Admin corrections with audit trail
- `bulk-mark-present`: Bulk student status updates

#### User Management

- `get-my-profile`, `get-my-dashboard`, `get-my-logs`: Student self-service
- `get-dosen-profile`, `update-dosen-profile`: Lecturer profile management

#### Role-Based Features

- `get-dosen-dashboard`: Lecturer analytics dashboard
- `get-admin-dashboard`: Administrator overview
- `get-global-attendance`: System-wide attendance monitoring
- `get-attendance-stats`: Analytics and reporting

#### CRUD Operations

- `crud-mahasiswa`, `crud-dosen`, `crud-mata-kuliah`, `crud-jadwal`, `crud-ruangan`, `crud-prodi`: Administrative data management

#### Reporting & Export

- `get-dosen-report`, `export-report`: Lecturer reports
- `get-admin-attendance-courses`: Course enrollment analytics

#### Support Functions

- `get-course-students`: View class rosters
- `provision-user`: Admin user account creation
- `get-notifications`: Real-time notification system
- `get-audit-logs`: Security audit trail
- `change-password`: User password updates

---

## 📊 Testing

### Setup

Tests use:

- **Framework**: Vitest with `happy-dom` environment
- **Setup**: `tests/setup.ts` imports `@testing-library/jest-dom/vitest`
- **Helpers**: `tests/helpers.tsx` provides `renderWithRouter()` for route-aware rendering
- **Mocking**: Mock `app/lib/api.ts` for edge function calls and `app/components/Toast` for notifications

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch
```

### Existing Test Coverage

- `tests/dosen/dashboard.test.tsx` - Lecturer dashboard functionality
- `tests/attendance.test.tsx` - Attendance management tests
- `tests/correction.test.tsx` - Attendance correction workflows
- `tests/sessions.test.tsx` - Session management tests

---

## ⚡ Realtime Features

The application uses Supabase Realtime WebSocket subscriptions:

- `useRealtimePresensi`: Attendance updates in real-time
- `useRealtimeSession`: Session status changes
- `useRealtimeNotifikasi`: Notification system
- `useSessionBroadcast`: Session progress broadcasting

---

## 🛡️ Configuration

### Environment Variables

Create `.env` file with:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Vite Configuration

`vite.config.ts` includes:

- React Router integration
- Tailwind CSS v4
- Basic SSL for development
- Host forwarding for tunneling

### React Router Configuration

`react-router.config.ts`:

- SSR enabled by default
- Can be disabled for SPA mode

---

## 🔗 Additional Resources

- **React Router**: https://reactrouter.com/
- **Vite**: https://vite.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **Supabase**: https://supabase.com/

---

_Last updated: $(date +%Y-%m-%d)_
