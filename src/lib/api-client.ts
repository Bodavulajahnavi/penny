/**
 * Browser-side API helpers.
 *
 * The HttpOnly session cookie is always the primary session. Some browsers refuse cookies for apps
 * embedded in another site's iframe (e.g. a preview pane), so after signing in we check whether the
 * cookie stuck; if it didn't, we keep the session token for this tab only (sessionStorage) and send
 * it as an `Authorization: Bearer` header.
 */
const STORAGE_KEY = "penny.session";
let fallbackToken: string | null | undefined;

function readFallbackToken(): string | null {
  if (fallbackToken === undefined) {
    try {
      fallbackToken = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      fallbackToken = null;
    }
  }
  return fallbackToken;
}

export function hasFallbackSession() {
  return Boolean(readFallbackToken());
}

export function setFallbackSession(token: string | null) {
  fallbackToken = token;
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the in-memory token still covers this page view.
  }
}

export function apiFetch(path: string, init: RequestInit = {}) {
  const requestHeaders = new Headers(init.headers);
  const token = readFallbackToken();
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  if (init.body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers: requestHeaders, credentials: "same-origin", cache: "no-store" });
}

export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (result as { error?: unknown }).error;
    throw new Error(typeof message === "string" ? message : "Something went wrong. Please try again.");
  }
  return result as T;
}

/** Call after a successful sign-in: keeps the cookie session, or falls back to a tab-scoped token. */
export async function rememberSession(token?: string) {
  setFallbackSession(null);
  if (!token) return;
  const current = await apiJson<{ user: unknown }>("/api/auth");
  if (!current.user) setFallbackSession(token);
}
