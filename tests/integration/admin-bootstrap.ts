// This suite may mutate only the disposable database created by admin-bootstrap-isolated.ts.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { terminateSubprocess } from "./subprocess";
import { Client } from "pg";
import { getPayload } from "payload";
import config from "../../payload.config";
import {
  BootstrapAlreadyInitializedError,
  bootstrapAdministrator,
} from "../../features/admin-security/bootstrap";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "Local databases only");
assert(
  /^\/sammen_admin_bootstrap_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname),
  "Disposable admin-bootstrap database only",
);
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3118";
assert.equal(new URL(baseURL).origin, "http://localhost:3118", "Expected the dedicated bootstrap server");

const runID = randomBytes(8).toString("hex");
const weakPassword = "short-password";
const firstPassword = `Bootstrap-${randomBytes(20).toString("base64url")}!9`;
const replacementPassword = `Replacement-${randomBytes(20).toString("base64url")}!9`;
const otherPassword = `Other-${randomBytes(20).toString("base64url")}!9`;
const cliPassword = `CLI-${randomBytes(20).toString("base64url")}!9`;
const firstEmail = `bootstrap-first-${runID}@example.invalid`;
const otherEmail = `bootstrap-other-${runID}@example.invalid`;
const cliEmail = `bootstrap-cli-${runID}@example.invalid`;
const payload = await getPayload({ config });
const database = new Client({ connectionString: databaseUrl.toString() });
let exitCode = 0;

type CLIResult = { status: number | null; output: string };

function administrator(name: string, email: string, password: string): Record<string, string> {
  return { name, email, password };
}

async function userCount(): Promise<number> {
  const result = await database.query<{ count: string }>("SELECT count(*)::text AS count FROM users");
  return Number(result.rows[0]?.count || 0);
}

async function postJSON(path: string, data: Record<string, unknown>, headers: HeadersInit = {}): Promise<Response> {
  return fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: baseURL, ...headers },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15_000),
  });
}

function multipartAdministrator(data: Record<string, string>): FormData {
  const form = new FormData();
  form.set("_payload", JSON.stringify({ ...data, "confirm-password": data.password }));
  return form;
}

function assertDenied(response: Response, label: string, exact403 = false): void {
  if (exact403) assert.equal(response.status, 403, `${label} must return HTTP 403`);
  else assert(response.status >= 400 && response.status < 500, `${label} must be rejected`);
}

function cookiePair(response: Response): string {
  const pair = (response.headers.get("set-cookie") || "").split(";", 1)[0] || "";
  assert(/^[^=]+=.+$/.test(pair), "Native login must set a non-empty authentication cookie");
  return pair;
}

async function nativeLogin(email: string, password: string): Promise<Response> {
  return postJSON("/api/users/login", { email, password });
}

async function runBootstrapCLI(input: string | Buffer, extraArguments: readonly string[] = []): Promise<CLIResult> {
  assert(Buffer.byteLength(input) <= 512 * 1024, "Test CLI input must remain bounded");
  const environment: NodeJS.ProcessEnv = {
    DATABASE_URL: databaseUrl.toString(),
    HOUSEHOLD_ACCESS_SECRET: process.env.HOUSEHOLD_ACCESS_SECRET,
    NODE_ENV: "production",
    PATH: process.env.PATH,
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
    PUBLIC_SITE_URL: baseURL,
  };
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/bootstrap-admin.ts", ...extraArguments], {
    cwd: process.cwd(), env: environment, stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  let exceededOutput = false;
  let timedOut = false;
  const collect = (chunk: Buffer) => {
    if (Buffer.byteLength(output) + chunk.byteLength > 1024 * 1024) {
      exceededOutput = true;
      void terminateSubprocess(child);
    } else output += chunk.toString();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  child.stdin.on("error", () => { /* Invalid/oversized inputs may be rejected before EOF. */ });
  const timer = setTimeout(() => { timedOut = true; void terminateSubprocess(child); }, 30_000);
  const status = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
    child.stdin.end(input);
  }).finally(() => clearTimeout(timer));
  assert.equal(timedOut, false, "Bootstrap CLI must exit promptly, including on rejected input");
  assert.equal(exceededOutput, false, "Bootstrap CLI output must remain bounded");
  for (const secret of [firstPassword, replacementPassword, otherPassword, cliPassword]) {
    // Compare booleans so assertion failures cannot print captured output or credentials.
    assert.equal(output.includes(secret), false, "Bootstrap CLI output must not contain an administrator password");
  }
  return { status, output };
}

async function deleteUser(id: number | string): Promise<void> {
  await payload.delete({ collection: "users", id, overrideAccess: true });
}

try {
  await database.connect();
  assert.equal(await userCount(), 0, "Fresh disposable bootstrap database must not contain users");

  const publicData = administrator("Public setup", firstEmail, firstPassword);
  const publicJSON = await postJSON("/api/users/first-register", publicData);
  assertDenied(publicJSON, "JSON first-register on an empty database", true);

  const publicMultipart = await fetch(`${baseURL}/api/users/first-register`, {
    method: "POST",
    headers: { Origin: baseURL },
    body: multipartAdministrator(publicData),
    signal: AbortSignal.timeout(15_000),
  });
  assertDenied(publicMultipart, "Multipart first-register on an empty database", true);

  for (const path of [
    "/api/users/first-register/",
    "/api/users%2Ffirst-register",
    "/api/users/first%2Dregister",
  ]) {
    const response = await postJSON(path, publicData);
    assertDenied(response, `First-register path variant ${path}`);
  }

  const methodOverride = await fetch(`${baseURL}/api/users/first-register`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      Origin: baseURL,
      "x-http-method-override": "POST",
    },
    body: JSON.stringify(publicData),
    signal: AbortSignal.timeout(15_000),
  });
  assertDenied(methodOverride, "Native method-override first-register attempt");
  assert.equal(await userCount(), 0, "No public first-register variant may create a user");

  const anonymousCreate = await postJSON("/api/users", publicData);
  assertDenied(anonymousCreate, "Unauthenticated normal Users create", true);
  assert.equal(await userCount(), 0, "Unauthenticated normal create must not persist");

  await assert.rejects(
    bootstrapAdministrator(payload, administrator("Weak bootstrap", firstEmail, weakPassword)),
    "Private bootstrap must enforce the native administrator password policy",
  );
  assert.equal(await userCount(), 0, "Weak private bootstrap must not create a row");

  const originalBeginTransaction = payload.db.beginTransaction;
  payload.db.beginTransaction = () => originalBeginTransaction.call(payload.db, { isolationLevel: "repeatable read" });
  const concurrent = await Promise.allSettled([
    bootstrapAdministrator(payload, administrator("First administrator", firstEmail, firstPassword)),
    bootstrapAdministrator(payload, administrator("Competing administrator", otherEmail, otherPassword)),
  ]).finally(() => { payload.db.beginTransaction = originalBeginTransaction; });
  const successes = concurrent.filter((result): result is PromiseFulfilledResult<{ id: number }> => result.status === "fulfilled");
  const failures = concurrent.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.equal(successes.length, 1, "Exactly one concurrent bootstrap must succeed");
  assert.equal(failures.length, 1, "Exactly one concurrent bootstrap must fail");
  assert(failures[0]?.reason instanceof BootstrapAlreadyInitializedError, "Losing bootstrap must report already initialized");
  assert.equal(await userCount(), 1, "Concurrent bootstrap must leave exactly one administrator");

  const firstID = successes[0].value.id;
  const winningEmail = concurrent[0]?.status === "fulfilled" ? firstEmail : otherEmail;
  const winningPassword = concurrent[0]?.status === "fulfilled" ? firstPassword : otherPassword;
  const losingPassword = concurrent[0]?.status === "fulfilled" ? otherPassword : firstPassword;
  const login = await nativeLogin(winningEmail, winningPassword);
  assert.equal(login.status, 200, "The bootstrapped administrator must authenticate through native login");
  const loggedIn = await login.json() as { user?: { id?: number | string } };
  assert.equal(String(loggedIn.user?.id), String(firstID), "Native login must preserve the bootstrapped identity");
  const cookie = cookiePair(login);

  const authorizedCreate = await postJSON(
    "/api/users",
    administrator("Other administrator", `authorized-${runID}@example.invalid`, otherPassword),
    { Cookie: cookie },
  );
  assert.equal(authorizedCreate.status, 201, "A bootstrapped administrator must be able to create another administrator");
  const authorized = await authorizedCreate.json() as { doc?: { id?: number | string } };
  const otherID = authorized.doc?.id;
  assert(otherID !== undefined, "Authorized create must return the new administrator ID");
  assert.equal(await userCount(), 2, "Authorized create must add exactly one administrator");

  await assert.rejects(
    bootstrapAdministrator(payload, administrator("Overwrite attempt", winningEmail, replacementPassword)),
    BootstrapAlreadyInitializedError,
  );
  assert.equal(await userCount(), 2, "A second bootstrap must not modify or add administrators");
  assert.equal((await nativeLogin(winningEmail, winningPassword)).status, 200, "Original bootstrap credentials must remain valid");
  assert.notEqual((await nativeLogin(winningEmail, replacementPassword)).status, 200, "Second bootstrap must not overwrite credentials");
  assert.notEqual((await nativeLogin(winningEmail, losingPassword)).status, 200, "Losing concurrent credentials must never authenticate");

  await deleteUser(otherID);
  await deleteUser(firstID);
  assert.equal(await userCount(), 0, "Owned helper fixtures must be fully deleted before CLI checks");
  const deniedAfterDeletion = await postJSON("/api/users/first-register", publicData);
  assertDenied(deniedAfterDeletion, "Public setup after deletion of the last user", true);
  assert.equal(await userCount(), 0, "Deleting the last user must not reopen public setup");

  // Reproduce Payload 3.94's swallowed COMMIT error with a deferred constraint.
  // Both helper and real CLI must refuse to claim success for the rolled-back row.
  await database.query(`CREATE FUNCTION test_reject_admin_bootstrap_commit() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic bootstrap commit failure'; END $$`);
  await database.query(`CREATE CONSTRAINT TRIGGER test_reject_admin_bootstrap_commit
    AFTER INSERT ON users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
    EXECUTE FUNCTION test_reject_admin_bootstrap_commit()`);
  try {
    await assert.rejects(
      bootstrapAdministrator(payload, administrator("Commit failure", cliEmail, cliPassword)),
      /Could not confirm administrator bootstrap commit/,
    );
    assert.equal(await userCount(), 0, "Failed COMMIT must leave no administrator");
    const failedCommitCLI = await runBootstrapCLI(JSON.stringify(administrator("Commit failure", cliEmail, cliPassword)));
    assert.notEqual(failedCommitCLI.status, 0, "CLI must fail if COMMIT was rejected");
    assert.equal(failedCommitCLI.output.includes("Administrator opprettet."), false, "Failed COMMIT must not report success");
    assert.equal(await userCount(), 0, "CLI failed COMMIT must leave no administrator");
  } finally {
    await database.query("DROP TRIGGER test_reject_admin_bootstrap_commit ON users");
    await database.query("DROP FUNCTION test_reject_admin_bootstrap_commit()");
  }

  const malformed = await runBootstrapCLI("{not-json\n");
  assert.notEqual(malformed.status, 0, "Malformed CLI JSON must fail");
  assert.equal(await userCount(), 0, "Malformed CLI input must not create a user");
  const invalidUTF8 = await runBootstrapCLI(Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]));
  assert.notEqual(invalidUTF8.status, 0, "Non-UTF-8 input must be rejected");

  const extraArguments = await runBootstrapCLI(`${JSON.stringify(administrator("CLI administrator", cliEmail, cliPassword))}\n`, ["--unexpected"]);
  assert.notEqual(extraArguments.status, 0, "CLI arguments must be rejected");
  assert.equal(await userCount(), 0, "Rejected CLI arguments must not create a user");
  const unknownField = await runBootstrapCLI(JSON.stringify({
    ...administrator("CLI administrator", cliEmail, cliPassword), role: "administrator",
  }));
  assert.notEqual(unknownField.status, 0, "Unknown CLI fields must be rejected");

  const oversized = await runBootstrapCLI(
    `${" ".repeat(256 * 1024)}${JSON.stringify(administrator("Oversized administrator", cliEmail, cliPassword))}`,
  );
  assert.notEqual(oversized.status, 0, "Oversized CLI stdin must be rejected");
  assert.equal(await userCount(), 0, "Oversized CLI input must not create a user");

  const cliInput = `${JSON.stringify(administrator("CLI administrator", cliEmail, cliPassword))}\n`;
  const successfulCLI = await runBootstrapCLI(cliInput);
  assert.equal(successfulCLI.status, 0, "First valid CLI bootstrap must succeed");
  assert.equal(await userCount(), 1, "Successful CLI bootstrap must create exactly one user");
  const cliLogin = await nativeLogin(cliEmail, cliPassword);
  assert.equal(cliLogin.status, 200, "CLI-created administrator must authenticate through native login");
  cookiePair(cliLogin);

  const nonemptyCLI = await runBootstrapCLI(`${JSON.stringify(administrator("Refused administrator", firstEmail, firstPassword))}\n`);
  assert.notEqual(nonemptyCLI.status, 0, "CLI must refuse a non-empty Users collection");
  assert.equal(await userCount(), 1, "Non-empty CLI refusal must not alter users");
  assert.notEqual((await nativeLogin(firstEmail, firstPassword)).status, 200, "Refused CLI credentials must not authenticate");

  console.log("PASS: private administrator bootstrap is atomic, public setup stays closed, and the stdin-only CLI fails closed.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await database.end().catch(() => undefined);
  await payload.destroy();
}
process.exit(exitCode);
