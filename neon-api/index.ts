import { Hono } from "hono";
import { corsHeaders, fail } from "./lib/http.ts";
import { HttpError } from "./lib/http.ts";
import authRoutes from "./routes/auth.ts";
import attendanceRoutes from "./routes/attendance.ts";
import dosenRoutes from "./routes/dosen.ts";
import adminRoutes from "./routes/admin.ts";
import realtimeRoutes from "./routes/realtime.ts";

const app = new Hono();

// CORS preflight for every route.
app.options("*", (c) => new Response(null, { status: 204, headers: corsHeaders(c) }));

app.get("/", (c) => c.json({ ok: true, service: "klas-api" }));
app.get("/health", async (c) => c.json({ ok: true, service: "klas-api" }));

// One sub-app per domain; each route path mirrors the old edge-function name so
// the browser client contract stays `POST /<function-name>`.
app.route("/", authRoutes);
app.route("/", attendanceRoutes);
app.route("/", dosenRoutes);
app.route("/", adminRoutes);
app.route("/", realtimeRoutes);

app.notFound((c) => c.json({ error: `Unknown endpoint: ${c.req.method} ${c.req.path}` }, 404, corsHeaders(c)));

app.onError((error, c) => {
  if (!(error instanceof HttpError)) console.error("[api]", error);
  return fail(c, error);
});

export default app;
