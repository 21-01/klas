# Klas. API Reference

The API now runs as one Neon Function (`api`, a Hono app in `neon-api/`) instead
of Supabase Edge Functions. Endpoint names are unchanged, so this page is kept
as a pointer.

- **Contract (source of truth):** `neon-api/CONTRACT.md`
- **Neon architecture and operations:** `docs/architecture/neon.md`
- **Implementation:** `neon-api/routes/` (`auth`, `attendance`, `dosen`, `admin`, `realtime`)

Every endpoint is `POST <VITE_NEON_API_URL>/<endpoint>` with
`Authorization: Bearer <JWT>`; `login` and `refresh-session` issue the session,
and `get-notifications` accepts its own auth for polling. Errors keep the
`{ "error": "<message>" }` envelope.
