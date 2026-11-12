// Scheduled maintenance function.
//
// Neon Function Triggers invoke this over HTTP with a POST whose JSON body is
// `{ data: { scheduled_at }, trigger, invocation_id }`. The URL is public, so
// the handler only runs when Neon's `X-Neon-Trigger-Invocation-Id` header is
// present (Neon strips client-supplied `X-Neon-*` headers). Both jobs are
// idempotent, so a retried invocation is harmless.

import { Hono } from "hono";
import { pool } from "./lib/db.ts";

const app = new Hono();

/** SQL helpers from neon/sql/001_functions.sql, in run order. */
const JOBS = ["auto_close_stale_sessions", "cleanup_expired_qr_codes"] as const;

interface JobResult {
  job: string;
  ok: boolean;
  affected: number;
  error?: string;
}

async function runJob(job: (typeof JOBS)[number]): Promise<JobResult> {
  try {
    const { rows } = await pool.query(`select public.${job}() as affected`);
    return { job, ok: true, affected: Number(rows[0]?.affected ?? 0) };
  } catch (error) {
    return {
      job,
      ok: false,
      affected: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

app.get("/", (c) => c.json({ ok: true, service: "klas-cron" }));

app.post("/", async (c) => {
  if (!c.req.header("x-neon-trigger-invocation-id")) {
    return c.json({ error: "Not a trigger invocation" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as
    | { data?: { scheduled_at?: string } }
    | null;
  const scheduledAt = body?.data?.scheduled_at ?? null;

  const results = await Promise.all(JOBS.map(runJob));
  const failed = results.filter((result) => !result.ok);

  console.log(`[maintenance] ${scheduledAt ?? "manual"}: ${JSON.stringify(results)}`);
  if (failed.length > 0) {
    // Surface a 5xx so the trigger records a failure and retries the occurrence.
    return c.json({ ok: false, scheduled_at: scheduledAt, results }, 500);
  }
  return c.json({ ok: true, scheduled_at: scheduledAt, results });
});

export default app;
