// Runtime configuration for the Neon Function.
// Neon injects DATABASE_URL, NEON_AUTH_* and AWS_* at runtime; see docs/neon.md.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

export const env = {
  /** Pooled connection string (request/response traffic). */
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  /** Direct connection string (transactions, LISTEN/NOTIFY). */
  get databaseUrlUnpooled() {
    return optional("DATABASE_URL_UNPOOLED", required("DATABASE_URL"));
  },
  /** Managed Better Auth base URL, e.g. https://<endpoint>/neondb/auth */
  get authBaseUrl() {
    return required("NEON_AUTH_BASE_URL").replace(/\/$/, "");
  },
  /** JWKS used to verify Managed Auth access tokens. */
  get jwksUrl() {
    return required("NEON_AUTH_JWKS_URL");
  },
  /** Symmetric secret for QR payloads (>= 32 chars). */
  get qrSecret() {
    return optional("QR_SECRET", "klas-dev-qr-secret-please-rotate-32");
  },
  objectStorage: {
    get endpoint() {
      return optional("AWS_ENDPOINT_URL_S3");
    },
    get region() {
      return optional("AWS_REGION", "ap-southeast-1");
    },
    get accessKeyId() {
      return optional("AWS_ACCESS_KEY_ID");
    },
    get secretAccessKey() {
      return optional("AWS_SECRET_ACCESS_KEY");
    },
    /** Bucket declared in neon.ts */
    get bucket() {
      return optional("KLAS_REPORT_BUCKET", "assets");
    },
  },
  /** Allowed browser origins for CORS. */
  get corsOrigins() {
    return optional("KLAS_CORS_ORIGINS", "*")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  /**
   * Demo mode: softens destructive behaviour for public presentations.
   * Enabled by setting KLAS_DEMO_MODE=true (or 1) in the Function environment.
   *
   * Effects (enforced by `assertMutable` in lib/http.ts):
   *  - Admin CRUD delete/deactivate actions are rejected (seed data survives).
   *  - Hard deletes of attendance sessions are rejected.
   *  - Dosen/admin edits and creates stay allowed so demos stay interactive.
   */
  get demoMode() {
    const value = process.env.KLAS_DEMO_MODE;
    return value === "true" || value === "1";
  },
};
