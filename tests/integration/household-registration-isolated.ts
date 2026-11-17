// This runner owns a disposable local database. It never changes the development database.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Client } from "pg";

const sourceUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(sourceUrl.hostname), "Local databases only");
const databaseName = `sammen_households_test_${Date.now()}_${randomBytes(3).toString("hex")}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;
const baseURL = "http://localhost:3103";
const environment: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: databaseUrl.toString(), NODE_ENV: "production", TEST_BASE_URL: baseURL, PUBLIC_SITE_URL: baseURL };
const administration = new Client({ connectionString: sourceUrl.toString() });
let control: Client | undefined;
let server: ChildProcess | undefined;
let created = false;
let serverOutput = "";
let exitCode = 0;

async function runNode(arguments_: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const process_ = spawn(process.execPath, arguments_, { env: environment, stdio: "inherit" });
    const timer = setTimeout(() => { process_.kill("SIGTERM"); reject(new Error("Test subprocess timed out")); }, 180_000);
    process_.once("error", (error) => { clearTimeout(timer); reject(error); });
    process_.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(); else reject(new Error(`Test subprocess exited with status ${code}`));
    });
  });
}

try {
  await administration.connect();
  await administration.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await runNode(["node_modules/payload/bin.js", "migrate"]);
  control = new Client({ connectionString: databaseUrl.toString() });
  await control.connect();
  // Roll back only this feature, not older unrelated migrations from the fresh batch.
  await control.query("UPDATE payload_migrations SET batch = 2 WHERE name = $1", ["20261117_140805_household_registration"]);
  await runNode(["node_modules/payload/bin.js", "migrate:down"]);
  const rolledBack = await control.query("SELECT to_regclass('households') AS table_name");
  assert.equal(rolledBack.rows[0].table_name, null);
  await runNode(["node_modules/payload/bin.js", "migrate"]);
  console.log("PASS: fresh migration chain, household rollback and reapplication.");

  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3103"], {
    env: environment, stdio: ["ignore", "pipe", "pipe"],
  });
  const collectOutput = (chunk: Buffer) => { serverOutput = (serverOutput + chunk.toString()).slice(-12_000); };
  server.stdout?.on("data", collectOutput);
  server.stderr?.on("data", collectOutput);
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Isolated server exited before readiness");
    if (serverOutput.includes("Ready")) {
      try {
        const response = await fetch(`${baseURL}/register`, { signal: AbortSignal.timeout(5000) });
        if (response.ok) { ready = true; break; }
      } catch { /* Server may still be starting. */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, "Isolated server did not become ready");
  await runNode(["--import", "tsx", "tests/integration/household-registration.ts"]);
} catch (error) {
  console.error(error);
  if (serverOutput) console.error(serverOutput);
  exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    const stopped = new Promise<void>((resolve) => server!.once("exit", () => resolve()));
    server.kill("SIGTERM");
    await stopped;
  }
  await control?.end();
  if (created) await administration.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await administration.end();
}
process.exit(exitCode);
