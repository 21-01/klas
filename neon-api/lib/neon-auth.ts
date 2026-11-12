import { env } from "./env.ts";
import { one } from "./db.ts";
import { HttpError } from "./http.ts";

// Thin client for Neon Auth (Managed Better Auth). All endpoints are plain HTTP
// with a JSON body; sessions are cookie-based, so a successful sign-in yields a
// signed `set-cookie` value that must be replayed to mint a JWT from /token.

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface SignInResult {
  user: AuthUser;
  /** Opaque Better Auth session token (not a JWT). */
  token: string;
  /** Signed session cookie value (`name=token.signature`), when provided. */
  cookie?: string;
}

export interface AuthSession {
  userId: string;
  token: string;
  expiresAt: Date;
}

interface AuthErrorBody {
  message?: string;
  code?: string;
}

/** Parses a JSON response without throwing on an empty/invalid body. */
async function readJson(res: Response): Promise<Record<string, any>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return {};
  }
}

function authError(res: Response, json: Record<string, any>, fallback: string): string {
  const message = (json as AuthErrorBody).message;
  return message || `${fallback} (status ${res.status})`;
}

/** Trusted browser origin that Better Auth accepts for cookie-bound calls. */
function originHeader(): string {
  return env.corsOrigins.find((origin) => origin !== "*") ?? "http://localhost:5173";
}

/** Collects the `name=value` pairs from a sign-in response's set-cookie header. */
function sessionCookie(res: Response): string | undefined {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (list.length > 0) return list.map((cookie) => cookie.split(";")[0]).join("; ");
  const raw = res.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : undefined;
}

function userFrom(json: Record<string, any>): AuthUser | null {
  const user = json.user;
  if (!user?.id) return null;
  return {
    id: String(user.id),
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
  };
}

/** POST /sign-in/email — throws 401 on invalid credentials. */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const res = await fetch(`${env.authBaseUrl}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: originHeader() },
    body: JSON.stringify({ email, password }),
  });
  const json = await readJson(res);
  const user = userFrom(json);
  if (!res.ok || !user) throw new HttpError(401, authError(res, json, "Invalid email or password"));

  return {
    user,
    token: String(json.token ?? ""),
    cookie: sessionCookie(res),
  };
}

/** POST /sign-up/email — throws 400 when the provider rejects the account. */
export async function signUpWithPassword(
  email: string,
  password: string,
  name: string,
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${env.authBaseUrl}/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: originHeader() },
    body: JSON.stringify({ email, password, name }),
  });
  const json = await readJson(res);
  const user = userFrom(json);
  if (!res.ok || !user) {
    throw new HttpError(400, `Auth provisioning failed: ${authError(res, json, "Unknown error")}`);
  }
  return { user };
}

/** Best-effort rollback for a half-provisioned account (no admin API available). */
export async function deleteAuthUser(userId: string): Promise<void> {
  try {
    await one(`delete from neon_auth."user" where id = $1 returning id`, [userId]);
  } catch (error) {
    console.warn("[neon-auth] could not delete auth user", userId, (error as Error).message);
  }
}

/**
 * Verifies the current password by re-authenticating, then changes it through
 * Better Auth. Throws 403 for a wrong current password, 501 when the provider
 * does not expose the change-password endpoint.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const authRow = await one<{ email: string }>(`select email from neon_auth."user" where id = $1`, [userId]);
  const profileRow = authRow
    ? null
    : await one<{ email: string }>(`select email from users where user_id = $1`, [userId]);
  const email = authRow?.email ?? profileRow?.email;
  if (!email) throw new HttpError(404, "Auth user not found");

  const signIn = await fetch(`${env.authBaseUrl}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: originHeader() },
    body: JSON.stringify({ email, password: currentPassword }),
  });
  const signInJson = await readJson(signIn);
  if (!signIn.ok || !signInJson.user?.id) {
    throw new HttpError(403, "Current password is incorrect");
  }
  const cookie = sessionCookie(signIn);
  if (!cookie) throw new HttpError(501, "Password change is not supported by the managed auth provider");

  let res: Response;
  try {
    res = await fetch(`${env.authBaseUrl}/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: originHeader(), cookie },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch (error) {
    console.warn("[neon-auth] change-password unavailable", (error as Error).message);
    throw new HttpError(501, "Password change is not supported by the managed auth provider");
  }

  const json = await readJson(res);
  if (res.status === 404 || res.status === 405 || res.status === 501) {
    throw new HttpError(501, "Password change is not supported by the managed auth provider");
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new HttpError(403, authError(res, json, "Current password is incorrect"));
  }
  if (!res.ok) throw new HttpError(500, authError(res, json, "Failed to update password"));
}

/**
 * Mints a Better Auth JWT via GET /token. The documented bearer form is tried
 * first; Neon Auth currently only honours the signed session cookie, so the
 * caller may pass the cookie obtained at sign-in. Returns null when a JWT
 * cannot be minted (callers fall back to the session token).
 */
export async function fetchJwtForSessionToken(
  sessionToken: string,
  cookie?: string,
): Promise<string | null> {
  const headers: Record<string, string> = {
    Origin: originHeader(),
    Authorization: `Bearer ${sessionToken}`,
  };

  try {
    let res = await fetch(`${env.authBaseUrl}/token`, { headers });
    if (!res.ok && cookie) {
      res = await fetch(`${env.authBaseUrl}/token`, {
        headers: { Origin: originHeader(), cookie },
      });
    }
    if (!res.ok) {
      console.warn("[neon-auth] /token returned", res.status);
      return null;
    }
    const json = await readJson(res);
    return typeof json.token === "string" && json.token ? json.token : null;
  } catch (error) {
    console.warn("[neon-auth] /token failed", (error as Error).message);
    return null;
  }
}

/** Loads a non-expired session row by its opaque token, or null. */
export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  const row = await one<{ userId: string; token: string; expiresAt: Date }>(
    `select "userId" as "userId", token, "expiresAt" as "expiresAt"
       from neon_auth.session
      where token = $1 and "expiresAt" > now()`,
    [token],
  );
  if (!row) return null;
  return {
    userId: row.userId,
    token: row.token,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt),
  };
}
