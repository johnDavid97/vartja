export const HOUSEHOLD_SESSION_COOKIE = "sammen-household-session";

/** Only an opaque token is stored in the cookie; no household details or access code. */
export function sessionTokenFromHeaders(headers: Headers): string | null {
  const entry = (headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${HOUSEHOLD_SESSION_COOKIE}=`));
  const token = entry?.slice(HOUSEHOLD_SESSION_COOKIE.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function sessionCookie(token: string, requestUrl: string, expiresAt?: Date): string {
  const url = new URL(requestUrl);
  // Production deployments behind a TLS reverse proxy may have an internal HTTP URL.
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const secure = url.protocol === "https:" || !loopback;
  return `${HOUSEHOLD_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}${expiresAt ? `; Expires=${expiresAt.toUTCString()}` : ""}`;
}

export function expiredSessionCookie(requestUrl: string): string {
  return `${sessionCookie("", requestUrl, new Date(0))}; Max-Age=0`;
}
