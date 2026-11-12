import type { Context } from "hono";
import { env } from "./env.ts";

/** An error that maps directly to an HTTP status + JSON envelope. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = "Invalid user token") => new HttpError(401, m);
export const forbidden = (m = "Forbidden: insufficient role") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);
export const conflict = (m = "Conflict") => new HttpError(409, m);

function resolveOrigin(c: Context): string {
  const origin = c.req.header("origin");
  const allowed = env.corsOrigins;
  if (allowed.includes("*")) return origin ?? "*";
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] ?? "";
}

export function corsHeaders(c: Context): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(c),
    "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** JSON response with CORS headers. */
export function ok<T>(c: Context, data: T, status = 200) {
  return c.json(data as object, status as never, corsHeaders(c));
}

/** Error envelope: { error: string } — same contract as the old edge functions. */
export function fail(c: Context, error: unknown) {
  if (error instanceof HttpError) {
    return c.json({ error: error.message }, error.status as never, corsHeaders(c));
  }
  console.error("[api] unhandled", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return c.json({ error: message }, 500, corsHeaders(c));
}

/** Plain-text response (CSV exports). */
export function text(c: Context, body: string, filename?: string) {
  const headers = corsHeaders(c);
  headers["Content-Type"] = "text/csv; charset=utf-8";
  if (filename) headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  return new Response(body, { status: 200, headers });
}

/** Strips prototype-pollution-prone keys from a parsed body. */
export function body<T = Record<string, unknown>>(value: unknown): T {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  return {} as T;
}
