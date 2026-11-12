import { z } from "zod";

/**
 * Permissive UUID shape check.
 *
 * Zod 4's `z.uuid()` enforces RFC-versioned UUIDs (version nibble + variant bits),
 * which rejects the synthetic deterministic ids used by this project's seed data
 * (`f0000000-0000-0000-0000-000000000001`, `c0000000-…`, …). Postgres accepts those
 * as `uuid`, so validation must too.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(message = "Invalid ID") {
  return z.string().regex(UUID_RE, message);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
