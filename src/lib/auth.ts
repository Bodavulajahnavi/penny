import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ensureDatabase } from "@/lib/bootstrap";

export const SESSION_COOKIE = "penny_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const TOKEN = /^[a-f0-9]{64}$/;

type UserRow = typeof users.$inferSelect;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** True for PostgreSQL unique-constraint violations (Drizzle wraps the driver error in `cause`). */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return Response.json({ error: "Please provide valid JSON." }, { status: 400 });
  if (isUniqueViolation(error)) {
    return Response.json({ error: "That already exists. Please refresh and try again." }, { status: 409 });
  }
  console.error("penny API error:", error);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    currency: user.currency,
    isDemo: user.isDemo,
    createdAt: user.createdAt.toISOString(),
  };
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Rejects cross-site writes. Browsers label every request with Sec-Fetch-Site, and requiring a JSON
 * body means classic HTML-form CSRF can't reach these endpoints either (cross-origin JSON needs CORS).
 */
export function assertSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new ApiError(403, "Cross-site requests are not allowed.");
  }
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (request.method !== "DELETE" && !contentType.includes("application/json")) {
    throw new ApiError(415, "Please send a JSON request.");
  }
}

/**
 * Over HTTPS the session cookie is `SameSite=None; Secure; Partitioned` so the app keeps working when
 * it is embedded in another site's iframe (such as a preview pane). Plain-HTTP localhost uses `Lax`.
 */
async function sessionCookieOptions(expires: Date) {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "";
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "").split(",")[0].trim();
  const secure = origin.startsWith("https://") || forwardedProto === "https" || !LOCAL_HOST.test(host);
  return secure
    ? { httpOnly: true, secure: true, sameSite: "none" as const, partitioned: true, path: "/", expires }
    : { httpOnly: true, secure: false, sameSite: "lax" as const, path: "/", expires };
}

/**
 * Session tokens come from the HttpOnly cookie or, when a browser refuses that cookie (for example
 * in a third-party iframe), from the tab-scoped `Authorization: Bearer` fallback in api-client.ts.
 */
async function requestTokens(): Promise<string[]> {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const tokens: string[] = [];
  const cookieToken = jar.get(SESSION_COOKIE)?.value;
  if (cookieToken && TOKEN.test(cookieToken)) tokens.push(cookieToken);
  const bearer = requestHeaders.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (bearer && !tokens.includes(bearer)) tokens.push(bearer);
  return tokens;
}

/** Starts a 30-day session, sets the cookie, and returns the raw token (only its hash is stored). */
export async function createSession(userId: string): Promise<string> {
  await ensureDatabase();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, await sessionCookieOptions(expiresAt));
  return token;
}

export async function getSession(): Promise<UserRow | null> {
  const tokens = await requestTokens();
  if (!tokens.length) return null;
  await ensureDatabase();
  for (const token of tokens) {
    const [result] = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (result) return result.user;
  }
  return null;
}

export async function requireUser() {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  return user;
}

export async function destroySession() {
  const tokens = await requestTokens();
  if (tokens.length) {
    await ensureDatabase();
    await db.delete(sessions).where(inArray(sessions.tokenHash, tokens.map(hashToken)));
  }
  (await cookies()).set(SESSION_COOKIE, "", { ...(await sessionCookieOptions(new Date(0))), maxAge: 0 });
}
