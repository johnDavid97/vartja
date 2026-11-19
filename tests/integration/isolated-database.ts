import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Client } from "pg";
import { runSubprocess, terminateSubprocess } from "./subprocess";
import { weddingPath } from "../../features/wedding-site/paths";

interface IsolatedIntegrationOptions {
  name: string;
  port: number;
  migration: string;
  testFile: string | readonly string[];
  verifyRollback: (database: Client) => Promise<void>;
  verifyReapply?: (database: Client) => Promise<void>;
}

/** Owns only a newly-created local DB and its server; never mutates the source DB. */
export async function runIsolatedIntegration(options: IsolatedIntegrationOptions): Promise<void> {
  const sourceUrl = new URL(process.env.DATABASE_URL || "");
  assert(["localhost", "127.0.0.1"].includes(sourceUrl.hostname), "Local databases only");
  assert(/^[a-z_]+$/.test(options.name));
  const databaseName = `sammen_${options.name}_test_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const databaseUrl = new URL(sourceUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const baseURL = `http://localhost:${options.port}`;
  const environment: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: databaseUrl.toString(), NODE_ENV: "production", TEST_BASE_URL: baseURL, PUBLIC_SITE_URL: baseURL };
  const administration = new Client({ connectionString: sourceUrl.toString() });
  let control: Client | undefined;
  let server: ChildProcess | undefined;
  let serverError: Error | undefined;
  let created = false;
  let serverOutput = "";

  async function runNode(arguments_: string[]): Promise<void> {
    await runSubprocess(process.execPath, arguments_, {
      spawn: { env: environment, stdio: "inherit" },
      timeoutMs: 180_000,
      terminationGraceMs: 10_000,
    });
  }

  try {
    await administration.connect();
    await administration.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await runNode(["node_modules/payload/bin.js", "migrate"]);
    control = new Client({ connectionString: databaseUrl.toString() });
    await control.connect();
    const target = await control.query("SELECT id FROM payload_migrations WHERE name = $1", [options.migration]);
    assert.equal(target.rows.length, 1, "Feature migration must exist before rollback");
    // Roll back dependent later migrations too: recreating an earlier table alone would
    // lose columns/constraints that later, still-recorded migrations added to it.
    await control.query("UPDATE payload_migrations SET batch = 2 WHERE id >= $1", [target.rows[0].id]);
    await runNode(["node_modules/payload/bin.js", "migrate:down"]);
    await options.verifyRollback(control);
    await runNode(["node_modules/payload/bin.js", "migrate"]);
    await options.verifyReapply?.(control);
    console.log("PASS: fresh migration chain, feature rollback and reapplication.");

    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(options.port)], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    server.once("error", (error) => { serverError = error; });
    const collectOutput = (chunk: Buffer) => { serverOutput = (serverOutput + chunk.toString()).slice(-12_000); };
    server.stdout?.on("data", collectOutput);
    server.stderr?.on("data", collectOutput);
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (serverError) throw serverError;
      if (server.exitCode !== null || server.signalCode !== null) throw new Error("Isolated server exited before readiness");
      if (serverOutput.includes("Ready")) {
        try {
          if ((await fetch(`${baseURL}${weddingPath("/register")}`, { signal: AbortSignal.timeout(5000) })).ok) { ready = true; break; }
        } catch { /* May still be starting. */ }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, "Isolated server did not become ready");
    const testFiles = typeof options.testFile === "string" ? [options.testFile] : options.testFile;
    for (const testFile of testFiles) await runNode(["--import", "tsx", testFile]);
  } catch (error) {
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    if (server) await terminateSubprocess(server);
    await control?.end();
    if (created) await administration.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await administration.end();
  }
}
