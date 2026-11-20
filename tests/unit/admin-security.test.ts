import { describe, expect, it } from "vitest";
import { generatePayloadCookie, type PasswordFieldValidation } from "payload";

import payloadConfig from "../../payload.config";
import { ADMIN_PASSWORD_MIN_LENGTH, validateAdministratorPassword } from "../../features/admin-security/password";
import {
  InvalidPublicSiteURLError,
  LOCAL_ADMIN_ORIGIN,
  resolveAdminSiteSecurity,
} from "../../features/admin-security/site-origin";

describe("administrator site origin", () => {
  it("uses a fixed localhost fallback without weakening cookies on an unconfigured deployment", () => {
    expect(resolveAdminSiteSecurity(undefined)).toEqual({ origin: LOCAL_ADMIN_ORIGIN, secureCookies: true });
    expect(resolveAdminSiteSecurity("   ", "production")).toEqual({ origin: LOCAL_ADMIN_ORIGIN, secureCookies: true });
    expect(resolveAdminSiteSecurity(undefined, "development").secureCookies).toBe(false);
    expect(resolveAdminSiteSecurity(undefined, "test").secureCookies).toBe(false);
  });

  it("canonicalizes the configured HTTPS origin, including IDNs and default ports", () => {
    expect(resolveAdminSiteSecurity(" https://vårtja.no:443/ ")).toEqual({
      origin: "https://xn--vrtja-mra.no",
      secureCookies: true,
    });
  });

  it.each([
    "wedding.example",
    "*",
    "https://*.example.test",
    "ftp://wedding.example",
    "http://wedding.example",
    "https://user:password@wedding.example",
    "https://wedding.example/admin",
    "https://wedding.example?preview=1",
    "https://wedding.example?",
    "https://wedding.example#fragment",
    "https://wedding.example#",
  ])("rejects a value that is not an exact safe origin: %s", (configuredURL) => {
    expect(() => resolveAdminSiteSecurity(configuredURL)).toThrow(InvalidPublicSiteURLError);
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3100", "http://127.12.3.4", "http://[::1]:3000"])(
    "permits disposable HTTP loopback use without Secure cookies: %s",
    (configuredURL) => expect(resolveAdminSiteSecurity(configuredURL).secureCookies).toBe(false),
  );
});

describe("sanitized Payload administrator security config", () => {
  it("pins CSRF, CORS, request URLs and native cookie flags to the canonical configured origin", async () => {
    const config = await payloadConfig;
    const users = config.collections.find(({ slug }) => slug === "users");
    if (!users?.auth) throw new Error("Missing users auth config");

    expect(config.serverURL).not.toBe("");
    expect(config.serverURL).not.toBe("*");
    expect(config.csrf).toEqual([config.serverURL]);
    expect(config.cors).toEqual([config.serverURL]);
    expect(users.auth.cookies).toMatchObject({
      sameSite: "Lax",
      secure: config.serverURL.startsWith("https://"),
    });

    const cookie = generatePayloadCookie({
      collectionAuthConfig: users.auth,
      cookiePrefix: config.cookiePrefix,
      token: "test-only-token",
    });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie.includes("Secure=true")).toBe(users.auth.cookies.secure);
  });

  it("uses one hidden virtual password override without changing storage fields", async () => {
    const config = await payloadConfig;
    const users = config.collections.find(({ slug }) => slug === "users");
    const passwordFields = users?.flattenedFields.filter((field) => "name" in field && field.name === "password") ?? [];

    expect(passwordFields).toHaveLength(1);
    expect(passwordFields[0]).toMatchObject({
      hidden: true,
      minLength: ADMIN_PASSWORD_MIN_LENGTH,
      virtual: true,
    });
    expect("validate" in passwordFields[0] && passwordFields[0].validate).toBe(validateAdministratorPassword);
  });
});

describe("administrator password policy", () => {
  const validate = (value: unknown, required = false) => validateAdministratorPassword(
    value as string,
    {
      name: "password",
      type: "text",
      blockData: {},
      data: {},
      event: "submit",
      path: ["password"],
      preferences: { fields: {} },
      req: {
        payload: { config: { defaultMaxTextLength: 40_000 } },
        t: (key: string) => key,
      },
      required,
      siblingData: {},
    } as Parameters<PasswordFieldValidation>[1],
  );

  it("accepts an omitted password on updates and existing short passwords remain login-compatible", () => {
    expect(validate(undefined)).toBe(true);
  });

  it("requires at least 15 characters whenever a new password is supplied", () => {
    expect(validate("x".repeat(ADMIN_PASSWORD_MIN_LENGTH - 1))).toBe("validation:longerThanMin");
    expect(validate("x".repeat(ADMIN_PASSWORD_MIN_LENGTH))).toBe(true);
  });

  it("retains native required and maximum-length checks and rejects non-strings", () => {
    expect(validate("", true)).toBe("validation:required");
    expect(validate("x".repeat(40_001))).toBe("validation:shorterThanMax");
    expect(validate(123456789012345)).toBe("validation:invalidInput");
  });
});
