import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    realtime: true,
  },
  auth: true,
  functions: {
    api: {
      name: "KLAS API",
      source: "./neon-api/index.ts",
      env: {
        // Symmetric secret used to encrypt QR check-in payloads.
        QR_SECRET: { value: process.env.QR_SECRET, required: true },
        // Realtime capability secret + client URL (not injected automatically at runtime).
        NEON_REALTIME_SECRET: { value: process.env.NEON_REALTIME_SECRET, required: true },
        NEON_REALTIME_URL: { value: process.env.NEON_REALTIME_URL, required: true },
        // Comma-separated browser origins allowed to call the API.
        KLAS_CORS_ORIGINS: { value: process.env.KLAS_CORS_ORIGINS, required: false },
        // Bucket used for report exports.
        KLAS_REPORT_BUCKET: { value: process.env.KLAS_REPORT_BUCKET ?? "assets", required: false },
      },
    },
  },
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    assets: { access: "private" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      return {};
    }
    if (!branch.exists) {
      return { ttl: "7d" };
    }
    return {};
  },
});
