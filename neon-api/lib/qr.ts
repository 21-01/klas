import { env } from "./env.ts";

// AES-GCM + PBKDF2, byte-compatible with supabase/functions/_shared/crypto.ts so
// tokens minted by either implementation verify in both.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getCryptoKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("QR secret must be at least 32 characters");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.slice(0, 32)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(secret.slice(0, 16)),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export async function encryptToken(text: string, secret = env.qrSecret): Promise<string> {
  const key = await getCryptoKey(secret, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text)),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return toBase64(combined);
}

export async function decryptToken(payload: string, secret = env.qrSecret): Promise<string> {
  const key = await getCryptoKey(secret, "decrypt");
  const bytes = fromBase64(payload);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(plaintext);
}

export interface QrPayload {
  sesi_id: string;
  server_timestamp: number;
  security_salt_token: string;
}

/** Random QR seed: sum of 8 random bytes, matching the edge-function helper. */
export function randomQrSeed(): number {
  return Array.from(crypto.getRandomValues(new Uint8Array(8))).reduce((a, b) => a + b, 0);
}

/** 16-char base64 salt used inside a QR payload. */
export function randomSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16))).slice(0, 16);
}
