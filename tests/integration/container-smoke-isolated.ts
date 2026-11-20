import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const image = process.env.CONTAINER_SMOKE_IMAGE || "samen-railway-check";
const runId = randomBytes(6).toString("hex");
const prefix = `sammen-smoke-${runId}`;
const resourcePattern = /^sammen-smoke-[a-f0-9]{12}-(app|db|failed|media|network)$/;
const appContainer = `${prefix}-app`;
const databaseContainer = `${prefix}-db`;
const failedContainer = `${prefix}-failed`;
const mediaVolume = `${prefix}-media`;
const network = `${prefix}-network`;
const databaseName = "sammen_container_smoke";
const databaseUser = "smoke";
const databasePassword = randomBytes(24).toString("base64url");
const payloadSecret = randomBytes(48).toString("base64url");
const householdSecret = randomBytes(48).toString("base64url");
const legacyPassword = `Legacy-${randomBytes(18).toString("base64url")}!9`;
const legacySalt = randomBytes(32).toString("hex");
// Payload <=3.91 stored an unprefixed 512-byte PBKDF2-SHA256 hash at 25,000 iterations.
const legacyHash = pbkdf2Sync(legacyPassword, legacySalt, 25_000, 512, "sha256").toString("hex");
const legacyEmail = `container-${runId}@example.invalid`;
const environmentFile = path.join(tmpdir(), `${prefix}.env`);
const outputDirectory = "/tmp/sammen-release-workers";
const logFile = path.join(outputDirectory, "final-container-smoke.log");
const secrets = [databasePassword, payloadSecret, householdSecret, legacyPassword, legacySalt, legacyHash];

for (const resource of [appContainer, databaseContainer, failedContainer, mediaVolume, network]) {
  assert(resourcePattern.test(resource), `Refusing unsafe disposable resource name: ${resource}`);
}

function redact(value: string): string {
  return secrets.reduce((result, secret) => result.replaceAll(secret, "[REDACTED]"), value);
}

function docker(arguments_: string[], allowFailure = false, input?: string): string {
  try {
    return execFileSync("docker", arguments_, { encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return "";
    const details = error instanceof Error && "stderr" in error
      ? String((error as Error & { stderr?: string }).stderr || "")
      : String(error);
    throw new Error(`Docker command failed: ${redact(details)}`);
  }
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function databaseCommand(arguments_: string[], input?: string): string {
  return docker(["exec", "-i", databaseContainer, "psql", "-X", "-U", databaseUser, "-d", databaseName, ...arguments_], false, input);
}

function migrationSnapshot(): string {
  return databaseCommand(["-Atc", "SELECT id || ':' || name || ':' || batch FROM payload_migrations ORDER BY id"]);
}

function databaseUserValue(id: string, column: "hash" | "salt"): string {
  assert(/^[a-zA-Z0-9-]+$/.test(id), "Native API returned an unsafe synthetic user ID");
  return databaseCommand(["-v", `fixture_id=${id}`, "-At"], `SELECT ${column} FROM users WHERE id = :'fixture_id';\n`);
}

function saveLogs(label: string, container: string): string {
  const logs = redact(docker(["logs", container]));
  appendFileSync(logFile, `\n--- ${label} ---\n${logs}\n`, { mode: 0o600 });
  return logs;
}

async function waitForDatabase(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (docker(["exec", databaseContainer, "pg_isready", "-U", databaseUser, "-d", databaseName], true)) return;
    await delay(500);
  }
  throw new Error("Disposable PostgreSQL container did not become ready");
}

async function waitForApplication(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const state = docker(["inspect", "--format", "{{.State.Status}}", appContainer], true);
    if (state === "exited" || state === "dead") throw new Error("Application container exited before HTTP readiness");
    try {
      const response = await fetch(baseUrl, { redirect: "follow", signal: AbortSignal.timeout(2_000) });
      if (response.status === 200) return;
    } catch {
      // Migration and server startup are still in progress.
    }
    await delay(500);
  }
  throw new Error("Application container did not become HTTP-ready");
}

function startApplication(port: number): void {
  docker([
    "run", "-d", "--name", appContainer,
    "--network", network,
    "--env-file", environmentFile,
    "-p", `127.0.0.1:${port}:3000`,
    "-v", `${mediaVolume}:/app/media`,
    image,
  ]);
}

async function assertRoute(baseUrl: string, route: string): Promise<void> {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, `${route} should return HTTP 200 (final URL: ${response.url})`);
}

async function verifyLegacyPasswordCompatibility(baseUrl: string): Promise<void> {
  const publicRegisterResponse = await fetch(`${baseUrl}/api/users/first-register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: legacyEmail, name: "Synthetic legacy administrator", password: legacyPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(publicRegisterResponse.status, 403, "Public first-user registration must remain permanently disabled");

  const bootstrapInput = `${JSON.stringify({
    email: legacyEmail,
    name: "Synthetic legacy administrator",
    password: legacyPassword,
  })}\n`;
  const bootstrapOutput = docker([
    "exec", "-i", "--user", "node", appContainer,
    "node", "--import", "tsx", "scripts/bootstrap-admin.ts",
  ], false, bootstrapInput);
  assert.equal(bootstrapOutput.includes(legacyPassword), false, "Bootstrap CLI output must not expose its stdin password");

  const initialLoginResponse = await fetch(`${baseUrl}/api/users/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: legacyEmail, password: legacyPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(initialLoginResponse.status, 200, "CLI-created administrator must authenticate through native login");
  const initiallyLoggedIn = await initialLoginResponse.json() as { user?: { id?: number | string } };
  const userId = String(initiallyLoggedIn.user?.id || "");
  assert(userId, "Native login should return the CLI-created synthetic identity");
  assert(initialLoginResponse.headers.get("set-cookie"), "Native login should establish a session cookie");

  const update = databaseCommand([
    "-v", `fixture_id=${userId}`,
    "-v", `legacy_hash=${legacyHash}`,
    "-v", `legacy_salt=${legacySalt}`,
  ], "UPDATE users SET hash = :'legacy_hash', salt = :'legacy_salt' WHERE id = :'fixture_id';\n");
  assert.match(update, /UPDATE 1/, "Only the synthetic administrator should receive the legacy hash fixture");
  assert.equal(databaseUserValue(userId, "hash"), legacyHash, "Fixture should contain the exact unprefixed legacy hash");

  const loginResponse = await fetch(`${baseUrl}/api/users/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: legacyEmail, password: legacyPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(loginResponse.status, 200, "Payload 3.94 should authenticate the Payload 3.91 password format");
  const loggedIn = await loginResponse.json() as { token?: string; user?: { id?: number | string } };
  assert.equal(String(loggedIn.user?.id || ""), userId, "Legacy login should preserve the same identity");
  assert(loggedIn.token, "Native login should return a token for the synthetic administrator");
  secrets.push(loggedIn.token);
  const anonymousSummary = await fetch(`${baseUrl}/api/household-summary`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(anonymousSummary.status, 403, "Administrator summary must reject anonymous requests, not serve a build-time error");
  const summary = await fetch(`${baseUrl}/api/household-summary`, {
    headers: { authorization: `JWT ${loggedIn.token}` },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(summary.status, 200, "Administrator summary should initialize with runtime credentials");
  assert.equal(summary.headers.get("cache-control"), "private, no-store");

  const rehashed = databaseUserValue(userId, "hash");
  assert.notEqual(rehashed, legacyHash, "Successful legacy login should opportunistically replace the hash");
  assert.match(rehashed, /^pbkdf2-sha256-(?:100k-)?v1:[a-f0-9]{64}$/, "Rehash should use a current Payload password format");
  assert.notEqual(databaseUserValue(userId, "salt"), legacySalt, "Opportunistic rehash should rotate the salt");
}

async function main(): Promise<void> {
  const port = await unusedPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(logFile, "Container smoke test (secrets redacted)\n", { mode: 0o600 });
  writeFileSync(environmentFile, [
    `DATABASE_URL=postgresql://${databaseUser}:${databasePassword}@${databaseContainer}:5432/${databaseName}`,
    `PAYLOAD_SECRET=${payloadSecret}`,
    `HOUSEHOLD_ACCESS_SECRET=${householdSecret}`,
    `PUBLIC_SITE_URL=${baseUrl}`,
    "NODE_ENV=production",
  ].join("\n") + "\n", { mode: 0o600 });
  chmodSync(environmentFile, 0o600);

  docker(["network", "create", network]);
  docker(["volume", "create", mediaVolume]);
  docker([
    "run", "-d", "--name", databaseContainer, "--network", network,
    "-e", `POSTGRES_USER=${databaseUser}`,
    "-e", `POSTGRES_PASSWORD=${databasePassword}`,
    "-e", `POSTGRES_DB=${databaseName}`,
    "postgres:17-alpine",
  ]);
  await waitForDatabase();

  startApplication(port);
  await waitForApplication(baseUrl);
  const firstLogs = saveLogs("first startup", appContainer);
  assert.match(firstLogs, /Migrat(?:ing|ed)|migration/i, "First startup should execute the migration CLI");

  const firstSnapshot = migrationSnapshot();
  assert(firstSnapshot.length > 0, "Fresh database should contain completed migration records");
  await verifyLegacyPasswordCompatibility(baseUrl);
  await Promise.all([
    assertRoute(baseUrl, "/"),
    assertRoute(baseUrl, "/andrea-og-martin"),
    assertRoute(baseUrl, "/andrea-og-martin/login"),
    assertRoute(baseUrl, "/admin"),
    assertRoute(baseUrl, "/api/globals/wedding"),
  ]);

  assert.equal(docker(["exec", appContainer, "sh", "-c", "awk '/^Uid:/{print $2}' /proc/1/status"]), "1000", "Server PID 1 must run as the non-root node user");
  // TypeScript is intentionally retained: Lexical declares it as an optional production peer.
  docker(["exec", appContainer, "sh", "-c", "npm ls --omit=dev --all >/dev/null && test -d node_modules/tsx && test -d node_modules/esbuild && test ! -e node_modules/@playwright/test && test ! -e node_modules/playwright-core && test ! -e node_modules/shadcn && test ! -e node_modules/vitest && test ! -e node_modules/eslint && test ! -e node_modules/tailwindcss && test ! -e node_modules/yaml"]);
  docker(["exec", "--user", "node", appContainer, "sh", "-c", "printf persistent-smoke > /app/media/container-smoke.txt"]);

  docker(["rm", "-f", appContainer]);
  startApplication(port);
  await waitForApplication(baseUrl);
  const secondLogs = saveLogs("second startup", appContainer);
  assert.match(secondLogs, /Reading migration files[\s\S]*Done\./i, "Second startup migration CLI should complete");
  assert.doesNotMatch(secondLogs, /Migrating:/i, "Second startup must not replay a migration");
  assert.equal(migrationSnapshot(), firstSnapshot, "Second startup must not alter completed migration records");
  assert.equal(docker(["exec", appContainer, "sh", "-c", "cat /app/media/container-smoke.txt"]), "persistent-smoke", "Mounted media must survive container replacement");

  docker([
    "run", "-d", "--name", failedContainer, "--network", network,
    "-e", "DATABASE_URL=postgresql://invalid:invalid@sammen-smoke-unreachable:5432/invalid",
    "-e", `PAYLOAD_SECRET=${payloadSecret}`,
    "-e", `HOUSEHOLD_ACCESS_SECRET=${householdSecret}`,
    image,
  ]);
  let failedState = "";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    failedState = docker(["inspect", "--format", "{{.State.Status}}", failedContainer]);
    if (failedState === "exited") break;
    await delay(500);
  }
  assert.equal(failedState, "exited", "A migration connection failure must stop startup");
  assert.notEqual(docker(["inspect", "--format", "{{.State.ExitCode}}", failedContainer]), "0", "Migration failure must produce a non-zero exit");
  const failedLogs = saveLogs("expected migration failure", failedContainer);
  assert.doesNotMatch(failedLogs, /Ready in|Local:/, "Server must not start after migration failure");

  console.log("PASS: actual entrypoint migrated a fresh disposable database and served all smoke routes.");
  console.log("PASS: native login accepted a synthetic Payload 3.91 hash and opportunistically rehashed it.");
  console.log("PASS: restart skipped migrations, retained media, and kept the server non-root.");
  console.log("PASS: production npm tree excludes Playwright/shadcn; migration failure is fail-closed.");
}

try {
  await main();
} finally {
  for (const container of [appContainer, failedContainer, databaseContainer]) {
    assert(resourcePattern.test(container));
    docker(["rm", "-f", container], true);
  }
  assert(resourcePattern.test(mediaVolume));
  docker(["volume", "rm", "-f", mediaVolume], true);
  assert(resourcePattern.test(network));
  docker(["network", "rm", network], true);
  rmSync(environmentFile, { force: true });
}
