import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@neon/functions";
import { env } from "./env.ts";

// One pool per isolate, reused across requests (see neon-functions skill).
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false },
});
attachDatabasePool(pool);

export type Row = Record<string, any>;

/** Runs a query and returns all rows. */
export async function many<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(sql, params as any[]);
  return result.rows as T[];
}

/** Runs a query and returns the first row, or null. */
export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await many<T>(sql, params);
  return rows[0] ?? null;
}

/** Runs a mutating query and returns the full result. */
export async function run(sql: string, params: unknown[] = []) {
  return pool.query(sql, params as any[]);
}

/** Runs `fn` inside a transaction and commits, rolling back on throw. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Maps Postgres unique-violation to a 409-friendly flag. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23503";
}

export function pgErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
}
