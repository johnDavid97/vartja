import { describe, expect, it } from "vitest";
import { expiredSessionCookie, HOUSEHOLD_SESSION_COOKIE, sessionCookie, sessionTokenFromHeaders } from "@/features/households/http/session-cookie";
import { householdAuthErrorResponse } from "@/features/households/http/auth-response";
import { AuthError } from "@/features/households/auth/errors";

const token = Buffer.alloc(32, 9).toString("base64url");
describe("household session HTTP boundary", () => {
  it("reads only the opaque session cookie and rejects malformed tokens", () => {
    expect(sessionTokenFromHeaders(new Headers())).toBeNull();
    expect(sessionTokenFromHeaders(new Headers({ cookie: `other=value; ${HOUSEHOLD_SESSION_COOKIE}=${token}` }))).toBe(token);
    expect(sessionTokenFromHeaders(new Headers({ cookie: `${HOUSEHOLD_SESSION_COOKIE}=invalid` }))).toBeNull();
  });
  it("uses HttpOnly, host-only, SameSite cookies and requires Secure outside local HTTP development", () => {
    const local = sessionCookie(token, "http://localhost:3000");
    expect(local).toContain("Path=/; HttpOnly; SameSite=Lax");
    expect(local).not.toContain("Secure");
    expect(local).not.toContain("Expires");
    expect(local).not.toContain("Domain=");
    expect(sessionCookie(token, "https://localhost")).toContain("Secure");
    const remembered = sessionCookie(token, "http://wedding.example", new Date("2028-01-01Z"));
    expect(remembered).toContain("Secure; Expires=");
    expect(expiredSessionCookie("https://wedding.example")).toContain("Max-Age=0");
  });
  it("does not reveal whether a name, code or household status was wrong", async () => {
    const invalid = householdAuthErrorResponse(new AuthError("INVALID_INPUT"));
    const denied = householdAuthErrorResponse(new AuthError("INVALID_CREDENTIALS"));
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual(await denied.json());
    expect(invalid.headers.get("Cache-Control")).toContain("no-store");
    const unavailable = householdAuthErrorResponse(new Error("secret database parameters"));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("secret database parameters");
  });
});
