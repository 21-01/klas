import { createAuthClient } from "@neon/auth";
import { SupabaseAuthAdapter } from "@neon/auth/vanilla/adapters";

const SSR = import.meta.env.SSR;

function createClient() {
  return createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
    adapter: SupabaseAuthAdapter({ fetchOptions: { credentials: "include" } }),
  });
}

export type KlasAuthClient = ReturnType<typeof createClient>;

/**
 * Neon Auth client. Browser only — the adapter is not constructed during SSR,
 * so no `import.meta.env` builders run on the server.
 */
export const auth: KlasAuthClient = SSR
  ? (undefined as unknown as KlasAuthClient)
  : createClient();

const TOKEN_SAFETY_MARGIN_MS = 30_000;

let cachedToken: { token: string; expiresAt: number } | null = null;

function assertBrowser(): void {
  if (SSR) {
    throw new Error("auth is browser-only");
  }
}

/**
 * Return the current Better Auth JWT, cached in memory until shortly before
 * it expires. Falls back to `getSession()` whenever the cache is stale.
 */
export async function getAccessToken(): Promise<string | null> {
  if (SSR) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const { data } = await auth.getSession();
  const session = data.session;
  if (!session?.access_token) {
    cachedToken = null;
    return null;
  }

  // Supabase `expires_at` is Unix seconds; keep a 30s safety margin.
  const expiresAt = session.expires_at
    ? session.expires_at * 1000 - TOKEN_SAFETY_MARGIN_MS
    : 0;

  if (expiresAt > now) {
    cachedToken = { token: session.access_token, expiresAt };
  } else {
    cachedToken = null;
  }

  return session.access_token;
}

export function clearAuthTokenCache(): void {
  cachedToken = null;
}

export async function signIn(email: string, password: string) {
  assertBrowser();
  const result = await auth.signInWithPassword({ email, password });
  if (result.error) {
    throw result.error;
  }
  // A fresh session invalidates any token we cached earlier.
  cachedToken = null;
  return result.data;
}

export async function signOut(): Promise<void> {
  if (SSR) return;
  try {
    await auth.signOut();
  } finally {
    cachedToken = null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  assertBrowser();
  const instance = auth.getBetterAuthInstance();
  const result = await (instance as unknown as {
    changePassword(input: {
      currentPassword: string;
      newPassword: string;
      revokeOtherSessions?: boolean;
    }): Promise<{ error?: { message?: string } | null } | undefined>;
  }).changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  });

  if (result?.error) {
    throw new Error(result.error.message || "Failed to change password");
  }
}

export async function getCurrentUser(): Promise<{ id: string; email?: string } | null> {
  if (SSR) return null;
  const { data } = await auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return { id: user.id, email: user.email };
}
