// Dependency-free S3-compatible object uploader (Neon Object Storage).
// Signs requests with AWS Signature Version 4 using Web Crypto only.

import { env } from "./env.ts";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data) as unknown as BufferSource);
  return toHex(digest);
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message) as unknown as BufferSource);
}

/** Percent-encodes one path segment the way SigV4 requires (RFC 3986). */
function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

interface Target {
  url: string;
  host: string;
  canonicalUri: string;
}

function buildTarget(key: string): Target {
  const { endpoint, bucket } = env.objectStorage;
  if (!endpoint) {
    throw new Error("Object storage endpoint is not configured (AWS_ENDPOINT_URL_S3)");
  }
  if (!bucket) {
    throw new Error("Object storage bucket is not configured (KLAS_REPORT_BUCKET)");
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(`Object storage endpoint is not a valid URL: ${endpoint}`);
  }

  const basePath = parsed.pathname.replace(/\/+$/, "");
  const objectPath = key.split("/").map(encodeSegment).join("/");
  const canonicalUri = `${basePath}/${encodeSegment(bucket)}/${objectPath}`;

  return {
    url: `${parsed.origin}${canonicalUri}`,
    host: parsed.host,
    canonicalUri,
  };
}

/** Public path-style URL for an object key. */
export function objectUrl(key: string): string {
  return buildTarget(key).url;
}

/**
 * Uploads an object with a SigV4-signed `PUT` and returns its key.
 * Throws a descriptive error when storage is not configured so callers can
 * degrade to a warning instead of failing the request.
 */
export async function putObject(
  key: string,
  body: string,
  contentType = "application/octet-stream",
): Promise<string> {
  const { region, accessKeyId, secretAccessKey } = env.objectStorage;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage credentials are not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
    );
  }

  const target = buildTarget(key);
  const payloadHash = await sha256Hex(body);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    target.canonicalUri,
    "",
    `host:${target.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    "",
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  let signingKey = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  signingKey = await hmac(signingKey, region);
  signingKey = await hmac(signingKey, "s3");
  signingKey = await hmac(signingKey, "aws4_request");
  const signature = toHex(await hmac(signingKey, stringToSign));

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };

  const response = await fetch(target.url, { method: "PUT", headers, body });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Object storage upload failed (${response.status} ${response.statusText})` +
        (detail ? `: ${detail.slice(0, 300)}` : ""),
    );
  }

  return key;
}
