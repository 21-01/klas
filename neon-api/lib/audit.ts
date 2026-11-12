import { run } from "./db.ts";

export type AuditCategory =
  | "Master Data"
  | "Schedule Plotting"
  | "Security Policies"
  | "Attendance Overrides"
  | "Authentication"
  | "Geofence"
  | "System";

export interface AuditEntry {
  userId?: string | null;
  kategori: AuditCategory;
  aksi: string;
  ip?: string | null;
  status?: "success" | "failed";
  metadata?: Record<string, unknown> | null;
}

/** Appends an audit row. Never throws: auditing must not break the request. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await run(
      `insert into audit_log (user_id, kategori, aksi, ip_address, status, metadata)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        entry.userId ?? null,
        entry.kategori,
        entry.aksi,
        entry.ip ?? null,
        entry.status ?? "success",
        entry.metadata ?? null,
      ],
    );
  } catch (error) {
    console.error("[audit] failed", (error as Error).message);
  }
}
