/** Small shared helpers: pagination math, CSV escaping, Jakarta dates. */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export function paginate(page: number, limit: number, total: number) {
  return {
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 0,
    } satisfies Pagination,
    offset: (page - 1) * limit,
  };
}

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Today's date in Asia/Jakarta as YYYY-MM-DD. */
export function jakartaToday(): string {
  return new Date(Date.now() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Day name (Indonesian) for a YYYY-MM-DD date in Asia/Jakarta. */
export function jakartaDayName(isoDate: string): string {
  // Noon +07:00 keeps the UTC calendar day equal to the Jakarta calendar day.
  const date = new Date(`${isoDate}T12:00:00+07:00`);
  return DAY_NAMES[date.getUTCDay()];
}

/** Generates `count` day labels ending today (Asia/Jakarta), oldest first. */
export function lastNDates(count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(new Date(Date.now() + JAKARTA_OFFSET_MS - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function rate(part: number, total: number): number {
  if (!total) return 0;
  return round2((part / total) * 100);
}

/** "12.3m" — matches the edge-function distance formatting. */
export function formatDistance(meters: number): string {
  return `${(Math.round(meters * 10) / 10).toFixed(1)}m`;
}
