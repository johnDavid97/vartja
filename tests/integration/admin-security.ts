// This suite is permitted to mutate only the disposable database created by admin-security-isolated.ts.
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { chromium, expect, type Browser } from "@playwright/test";
import { Client } from "pg";
import { getPayload } from "payload";
import config from "../../payload.config";
import { bootstrapAdministrator } from "../../features/admin-security/bootstrap";
import { terminateSubprocess } from "./subprocess";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "Local databases only");
assert(
  /^\/sammen_admin_security_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname),
  "Disposable admin-security database only",
);
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3117";
assert.equal(new URL(baseURL).origin, "http://localhost:3117", "Expected the dedicated loopback server");

const httpsOrigin = "https://admin.example.test";
const evilOrigin = "https://evil.example.test";
const secureServerURL = "http://127.0.0.1:3120";
const weakPassword = "short-password"; // 14 characters: deliberately below the policy.
const strongPassword = `Strong-${randomBytes(18).toString("base64url")}`;
const resetPassword = `Reset-${randomBytes(18).toString("base64url")}`;
const updatedPassword = `Update-${randomBytes(18).toString("base64url")}`;
const runID = randomBytes(8).toString("hex");
const firstEmail = `security-first-${runID}@example.invalid`;
const legacyEmail = `security-legacy-${runID}@example.invalid`;
const foreignEmail = `security-foreign-${runID}@example.invalid`;
const trustedEmail = `security-trusted-${runID}@example.invalid`;

const payload = await getPayload({ config });
const database = new Client({ connectionString: databaseUrl.toString() });
let browser: Browser | undefined;
let secureServer: ChildProcess | undefined;
let secureServerOutput = "";
let exitCode = 0;

function jsonHeaders(origin: string): HeadersInit {
  return { "content-type": "application/json", Origin: origin };
}

async function userCount(): Promise<number> {
  const result = await database.query<{ count: string }>("SELECT count(*)::text AS count FROM users");
  return Number(result.rows[0]?.count || 0);
}

async function requestJSON(
  url: string,
  method: string,
  data: Record<string, unknown>,
  headers: HeadersInit = {},
): Promise<Response> {
  return fetch(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15_000),
  });
}

function assertRejected(response: Response, label: string): void {
  assert(response.status >= 400 && response.status < 500, `${label} should be rejected, got HTTP ${response.status}`);
}

function cookiePair(setCookie: string): string {
  const pair = setCookie.split(";", 1)[0] || "";
  assert(/^[^=]+=.+$/.test(pair), "Authentication response must set a non-empty cookie");
  return pair;
}

function assertCookieFlags(setCookie: string, secure: boolean): void {
  // Assert booleans so a failing check never prints a session token.
  assert(/(?:^|;)\s*HttpOnly(?:=true)?(?:;|$)/i.test(setCookie), "Authentication cookie must be HttpOnly");
  assert(/(?:^|;)\s*SameSite=Lax(?:;|$)/i.test(setCookie), "Authentication cookie must be SameSite=Lax");
  assert.equal(/(?:^|;)\s*Secure(?:=true)?(?:;|$)/i.test(setCookie), secure, "Secure must match the configured origin policy");
}

function multipartUser(email: string, name: string, password: string): FormData {
  const form = new FormData();
  form.set("_payload", JSON.stringify({ email, name, password, "confirm-password": password }));
  return form;
}

async function assertPortAvailable(port: number): Promise<void> {
  const guard = createServer();
  await new Promise<void>((resolve, reject) => {
    guard.once("error", reject);
    guard.listen(port, "127.0.0.1", resolve);
  });
  await new Promise<void>((resolve, reject) => guard.close((error) => error ? reject(error) : resolve()));
}

async function startSecureOriginServer(): Promise<void> {
  await assertPortAvailable(3120);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl.toString(),
    NODE_ENV: "production",
    PUBLIC_SITE_URL: httpsOrigin,
  };
  secureServer = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3120"],
    { env: environment, stdio: ["ignore", "pipe", "pipe"] },
  );
  const collect = (chunk: Buffer) => { secureServerOutput = (secureServerOutput + chunk.toString()).slice(-12_000); };
  secureServer.stdout?.on("data", collect);
  secureServer.stderr?.on("data", collect);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    assert.equal(secureServer.exitCode, null, "Secure-origin server exited before readiness");
    try {
      const response = await fetch(`${secureServerURL}/api/users/me`, {
        headers: { Origin: httpsOrigin },
        signal: AbortSignal.timeout(1_500),
      });
      if (response.status < 500) return;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Secure-origin server did not become ready");
}

try {
  await database.connect();
  assert.deepEqual(payload.config.csrf, [baseURL], "CSRF allowlist must contain exactly PUBLIC_SITE_URL");
  assert.equal(await userCount(), 0, "Fresh disposable database must not contain users");

  const publicFirstRegister = await requestJSON(
    `${baseURL}/api/users/first-register`,
    "POST",
    { email: firstEmail, name: "First administrator", password: strongPassword },
    jsonHeaders(baseURL),
  );
  assert.equal(publicFirstRegister.status, 403, "Public first-user registration must remain permanently disabled");
  assert.equal(await userCount(), 0, "Denied public setup must not create a user");

  await assert.rejects(
    bootstrapAdministrator(payload, {
      email: firstEmail,
      name: "First administrator",
      password: weakPassword,
    }),
    "The private bootstrap helper must enforce the administrator password policy",
  );
  assert.equal(await userCount(), 0, "Rejected private bootstrap must not create a user");

  const firstAdministrator = await bootstrapAdministrator(payload, {
    email: firstEmail,
    name: "First administrator",
    password: strongPassword,
  });
  const firstUserID = firstAdministrator.id;
  assert(firstUserID !== undefined, "Private bootstrap must return its user ID");
  assert.equal(await userCount(), 1, "Private bootstrap must create exactly one administrator");

  const firstLogin = await requestJSON(
    `${baseURL}/api/users/login`,
    "POST",
    { email: firstEmail, password: strongPassword },
    jsonHeaders(baseURL),
  );
  assert.equal(firstLogin.status, 200, "Bootstrapped administrator must authenticate through native login");
  const firstResult = await firstLogin.json() as { user?: { id?: number | string } };
  assert.equal(String(firstResult.user?.id), String(firstUserID), "Native login must return the bootstrapped identity");
  assert.equal(Object.hasOwn(firstResult.user || {}, "password"), false, "Native auth responses must not expose plaintext passwords");
  const httpSetCookie = firstLogin.headers.get("set-cookie") || "";
  assertCookieFlags(httpSetCookie, false);
  const httpCookie = cookiePair(httpSetCookie);

  const weakCreate = await requestJSON(
    `${baseURL}/api/users`,
    "POST",
    { email: `security-weak-${runID}@example.invalid`, name: "Weak create", password: weakPassword },
    { Cookie: httpCookie, Origin: baseURL },
  );
  assertRejected(weakCreate, "Authorized weak user creation");
  assert.equal(await userCount(), 1, "Rejected weak creation must not persist");

  const weakUpdate = await requestJSON(
    `${baseURL}/api/users/${firstUserID}`,
    "PATCH",
    { password: weakPassword },
    { Cookie: httpCookie, Origin: baseURL },
  );
  assertRejected(weakUpdate, "Authorized weak password update");

  const nameUpdate = await requestJSON(
    `${baseURL}/api/users/${firstUserID}`,
    "PATCH",
    { name: "Renamed administrator" },
    { Cookie: httpCookie, Origin: baseURL },
  );
  assert.equal(nameUpdate.status, 200, "Name-only edit should remain valid");
  const selectedPassword = await fetch(`${baseURL}/api/users/${firstUserID}?select[password]=true`, {
    headers: { Cookie: httpCookie, Origin: baseURL },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(selectedPassword.status, 200);
  assert.equal(Object.hasOwn(await selectedPassword.json(), "password"), false, "Selecting the virtual field must not reveal a password");

  browser = await chromium.launch();
  const adminContext = await browser.newContext({ baseURL });
  const browserLogin = await adminContext.request.post("/api/users/login", {
    headers: { Origin: baseURL },
    data: { email: firstEmail, password: strongPassword },
  });
  assert(browserLogin.ok(), "Browser setup login failed");
  const browserCookie = (await adminContext.cookies()).find((cookie) => cookie.name === "payload-token");
  assert.equal(browserCookie?.httpOnly, true);
  assert.equal(browserCookie?.sameSite, "Lax");
  assert.equal(browserCookie?.secure, false);
  const userForm = await adminContext.newPage();
  await userForm.goto("/admin/collections/users/create");
  await expect(userForm).toHaveURL(/\/admin\/collections\/users\/create(?:\?|$)/);
  await expect(userForm.locator('input[name="password"]')).toHaveCount(1);
  await expect(userForm.locator('input[name="confirm-password"]')).toHaveCount(1);
  await expect(userForm.locator('input[name="password"]')).toHaveAttribute("type", "password");
  await expect(userForm.locator('input[name="confirm-password"]')).toHaveAttribute("type", "password");
  await adminContext.close();

  const resetToken = await payload.forgotPassword({
    collection: "users",
    data: { email: firstEmail },
    disableEmail: true,
  });
  assert(resetToken, "disableEmail forgotPassword must return the native reset token");
  const weakReset = await requestJSON(
    `${baseURL}/api/users/reset-password`,
    "POST",
    { token: resetToken, password: weakPassword },
    jsonHeaders(baseURL),
  );
  assertRejected(weakReset, "Weak native reset");
  const strongReset = await requestJSON(
    `${baseURL}/api/users/reset-password`,
    "POST",
    { token: resetToken, password: resetPassword },
    jsonHeaders(baseURL),
  );
  assert.equal(strongReset.status, 200, "Strong native reset failed");
  const resetLogin = await requestJSON(
    `${baseURL}/api/users/login`,
    "POST",
    { email: firstEmail, password: resetPassword },
    jsonHeaders(baseURL),
  );
  assert.equal(resetLogin.status, 200, "Strong reset password must authenticate");
  const oldSession = await fetch(`${baseURL}/api/users`, {
    headers: { Cookie: httpCookie, Origin: baseURL }, signal: AbortSignal.timeout(10_000),
  });
  assert.equal(oldSession.status, 403, "Password reset must retain native revocation of prior sessions");
  const strongUpdate = await requestJSON(`${baseURL}/api/users/${firstUserID}`, "PATCH", {
    password: updatedPassword,
  }, { Cookie: cookiePair(resetLogin.headers.get("set-cookie") || ""), Origin: baseURL });
  assert.equal(strongUpdate.status, 200, "A compliant password update must succeed");
  const updatedLogin = await requestJSON(`${baseURL}/api/users/login`, "POST", {
    email: firstEmail, password: updatedPassword,
  }, jsonHeaders(baseURL));
  assert.equal(updatedLogin.status, 200, "Updated password must authenticate");

  const legacyShortPassword = `old-${runID.slice(0, 6)}`;
  assert(legacyShortPassword.length < 15);
  const legacy = await payload.create({
    collection: "users",
    overrideAccess: true,
    data: { email: legacyEmail, name: "Synthetic legacy administrator", password: strongPassword },
  });
  const legacySalt = randomBytes(32).toString("hex");
  const legacyHash = pbkdf2Sync(legacyShortPassword, legacySalt, 25_000, 512, "sha256").toString("hex");
  const fixture = await database.query(
    "UPDATE users SET hash = $1, salt = $2 WHERE id = $3",
    [legacyHash, legacySalt, legacy.id],
  );
  assert.equal(fixture.rowCount, 1, "Synthetic legacy hash fixture must affect exactly one disposable user");
  const legacyLogin = await requestJSON(
    `${baseURL}/api/users/login`,
    "POST",
    { email: legacyEmail, password: legacyShortPassword },
    jsonHeaders(baseURL),
  );
  assert.equal(legacyLogin.status, 200, "Existing short-password hashes must remain login-compatible");

  await startSecureOriginServer();
  const secureLogin = await requestJSON(
    `${secureServerURL}/api/users/login`,
    "POST",
    { email: firstEmail, password: updatedPassword },
    jsonHeaders(httpsOrigin),
  );
  assert.equal(secureLogin.status, 200, "HTTPS-origin login failed");
  const secureSetCookie = secureLogin.headers.get("set-cookie") || "";
  assertCookieFlags(secureSetCookie, true);
  const secureCookie = cookiePair(secureSetCookie);

  for (const origin of [httpsOrigin, evilOrigin]) {
    const preflight = await fetch(`${secureServerURL}/api/users`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
      signal: AbortSignal.timeout(10_000),
    });
    const allowed = preflight.headers.get("access-control-allow-origin");
    if (origin === httpsOrigin) assert.equal(allowed, httpsOrigin, "CORS must admit only the configured origin");
    else {
      assert.notEqual(allowed, evilOrigin, "CORS must not admit a sibling origin");
      assert.notEqual(allowed, "*", "CORS must never fall back to a wildcard");
    }
  }

  const beforeForeign = await userCount();
  const foreignCreate = await fetch(`${secureServerURL}/api/users`, {
    method: "POST",
    headers: { Cookie: secureCookie, Origin: evilOrigin },
    body: multipartUser(foreignEmail, "Foreign origin", strongPassword),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(foreignCreate.status, 403, "Same-site foreign-Origin cookie mutation must be forbidden");
  assert.equal(await userCount(), beforeForeign, "Rejected CSRF request must not create a user");

  const trustedCreate = await fetch(`${secureServerURL}/api/users`, {
    method: "POST",
    headers: { Cookie: secureCookie, Origin: httpsOrigin },
    body: multipartUser(trustedEmail, "Trusted origin", strongPassword),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(trustedCreate.status, 201, "Trusted multipart creation failed");
  assert.equal(await userCount(), beforeForeign + 1, "Trusted origin should create exactly one user");

  const csrfContext = await browser.newContext();
  const [cookieName, cookieValue] = secureCookie.split("=", 2);
  assert(cookieName && cookieValue, "Secure cookie pair must be parseable");
  await csrfContext.addCookies([{
    name: cookieName,
    value: cookieValue,
    domain: "admin.example.test",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  }]);
  let browserCookieSent = false;
  let browserStatus: number | undefined;
  await csrfContext.route(`${evilOrigin}/**`, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<form id="csrf" method="post" enctype="multipart/form-data" action="${httpsOrigin}/api/users"><input name="_payload" value='${JSON.stringify({ email: `security-browser-foreign-${runID}@example.invalid`, name: "Browser foreign origin", password: strongPassword, "confirm-password": strongPassword }).replaceAll("'", "&#39;")}'></form>`,
    });
  });
  await csrfContext.route(`${httpsOrigin}/api/users`, async (route) => {
    const headers = await route.request().allHeaders();
    browserCookieSent = headers.cookie?.includes(`${cookieName}=`) === true;
    assert.equal(headers.origin, evilOrigin, "Browser must generate the foreign Origin itself");
    const forwardedHeaders = { ...headers };
    delete forwardedHeaders.host;
    delete forwardedHeaders["content-length"];
    const response = await fetch(`${secureServerURL}/api/users`, {
      method: "POST",
      headers: forwardedHeaders,
      body: route.request().postData() || "",
      signal: AbortSignal.timeout(15_000),
    });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    browserStatus = response.status;
  });
  const browserCount = await userCount();
  const csrfPage = await csrfContext.newPage();
  await csrfPage.goto(`${evilOrigin}/attack`);
  await csrfPage.locator("form").evaluate((form: HTMLFormElement) => form.submit());
  await expect.poll(() => browserStatus).toBe(403);
  assert(browserCookieSent, "The same-site browser CSRF attempt must include the auth cookie");
  assert.equal(await userCount(), browserCount, "Browser CSRF attempt must never create a user");
  await csrfContext.close();

  console.log("PASS: isolated native admin password policy, reset flow, legacy login, cookie flags, exact-origin CSRF, multipart mutation, browser same-site CSRF and native password controls.");
} catch (error) {
  if (secureServerOutput) console.error(secureServerOutput);
  console.error(error);
  exitCode = 1;
} finally {
  if (secureServer) await terminateSubprocess(secureServer);
  await browser?.close();
  await database.end().catch(() => undefined);
  await payload.destroy();
}
process.exit(exitCode);
