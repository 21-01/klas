# Neon backend

The app previously ran on Supabase (Postgres + RLS + Auth + Realtime + 37 edge
functions). It now runs on a single Neon project:

| Concern | Before | Now |
| --- | --- | --- |
| Database | Supabase Postgres | Neon Lakebase Postgres (branch `production`) |
| API | 37 Supabase edge functions | one Neon Function `api` (`neon-api/`) — a Hono app |
| Auth | Supabase Auth (GoTrue) | Neon Auth — Managed Better Auth, `neon_auth` schema |
| Live updates | Supabase Realtime channels | Neon Realtime sealed live queries |
| Report exports | CSV response body | CSV body + upload to Neon Object Storage (`assets`) |
| Authorization | RLS policies | explicit checks in `neon-api/lib/auth.ts` |
| Scheduled jobs | `pg_cron` | Neon Function Trigger `klas-maintenance`, every 5 minutes (UTC) |

## Layout

```
neon.ts                 Neon IaC: auth, functions.api, functions.cron, buckets.assets, realtime, triggers
neon/sql/001_functions.sql   schema reconciliation + SQL helpers
neon-api/
  index.ts              Hono app, CORS, error envelope, route mounts
  cron.ts               scheduled maintenance handler (Function Trigger target)
  CONTRACT.md           endpoint spec (source of truth for the port)
  lib/                  env, db (pg pool), http, auth (JWT + roles), qr, geo, audit, util, storage
  routes/               auth, attendance, dosen, admin, realtime
scripts/                db runner, auth-user provisioning, seed, smoke test
```

## Request contract

The browser calls `POST <VITE_NEON_API_URL>/<function-name>` with
`Authorization: Bearer <JWT>`. Path names are unchanged from the edge functions
(`login`, `check-in`, `get-dosen-dashboard`, …), so `app/lib/api.ts` kept its
public shape.

Errors keep the old envelope: `{ "error": "<message>" }`.

## Auth

- Sign-in, session and password changes go through `@neon/auth`
  (`createAuthClient` + `SupabaseAuthAdapter`, HTTP-only cookie).
- The browser sends the 15-minute EdDSA JWT from `session.token` as a bearer token.
- The Function verifies it against `NEON_AUTH_JWKS_URL` with issuer = origin of
  `NEON_AUTH_BASE_URL`, then loads the profile from `public.users`.
- `public.users.user_id` **is** the Neon Auth user id, so `mahasiswa.user_id` and
  `dosen.user_id` line up with the JWT `sub`.

## Database

Canonical schema: `supabase/migrations/001_core.sql` … `004_security.sql`.
RLS (`006_rls.sql`), the Supabase realtime publication (`007_realtime.sql`) and the
`pg_cron` jobs (`008_scheduled_tasks.sql`) are **not** applied — Neon has no
Supabase auth schema or realtime publication, and authorization lives in the API.

`neon/sql/001_functions.sql` adds what the API needs on top of that schema:
extended role vocabulary, `check_and_record_failed_login`,
`auto_close_stale_sessions`, `cleanup_expired_qr_codes`.

## Scheduled maintenance

The functions that ran under `pg_cron` on Supabase now run as a Neon Function
Trigger. `neon.ts` declares the `cron` function and the `klas-maintenance`
trigger (`*/5 * * * *`, UTC); Neon invokes `cron.ts` with a POST whose body
carries `data.scheduled_at`. The handler rejects calls without the
`X-Neon-Trigger-Invocation-Id` header, then runs both SQL helpers and returns a
5xx if either fails so the occurrence is retried.

```bash
npx neon config plan --env .env.local   # expect "+ function cron" and "+ trigger klas-maintenance"
npx neon deploy --env .env.local --yes  # deploys api + cron and applies the trigger
npx neon triggers list                  # shows the schedule and next run
npx neon logs query --source function --service-name neon-function/cron
```

## Local workflow

```bash
pnpm db:setup        # apply schema + SQL helpers, create auth users, seed demo data
pnpm neon:deploy     # bundle + deploy the api function, push Function env
pnpm smoke           # end-to-end checks against the deployed function
pnpm build           # frontend build
```

`neon dev` serves the function locally with hot reload and injects
`DATABASE_URL`/`NEON_*`, which is the quickest loop for API changes.

## Demo data

`scripts/auth-users.mjs` creates five users (password `KlasDemo#2026`):

| Email | Role |
| --- | --- |
| admin@klas.unj.ac.id | admin |
| samudra.adi@unj.ac.id | dosen |
| nandana.ammar@mhs.unj.ac.id | mahasiswa |
| nadine.alysha@mhs.unj.ac.id | mahasiswa |
| fathya.khairani@mhs.unj.ac.id | mahasiswa |

`scripts/seed.mjs` adds one prodi, five courses, ten rooms, five schedules
(one per weekday, all taught by Samudra Adi Guna) and enrolls all three students
in every schedule.
