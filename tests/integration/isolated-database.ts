import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Client } from "pg";

interface IsolatedIntegrationOptions {
  name: string;
  port: number;
  migration: string;
  testFile: string;
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
  let created = false;
  let serverOutput = "";

  async function runNode(arguments_: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, arguments_, { env: environment, stdio: "inherit" });
      const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Test subprocess timed out")); }, 180_000);
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", (code) => {
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
    await control.query("UPDATE payload_migrations SET batch = 2 WHERE name = $1", [options.migration]);
    await runNode(["node_modules/payload/bin.js", "migrate:down"]);
    await options.verifyRollback(control);
    await runNode(["node_modules/payload/bin.js", "migrate"]);
    await options.verifyReapply?.(control);
    console.log("PASS: fresh migration chain, feature rollback and reapplication.");

    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(options.port)], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    const collectOutput = (chunk: Buffer) => { serverOutput = (serverOutput + chunk.toString()).slice(-12_000); };
    server.stdout?.on("data", collectOutput);
    server.stderr?.on("data", collectOutput);
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (server.exitCode !== null) throw new Error("Isolated server exited before readiness");
      if (serverOutput.includes("Ready")) {
        try {
          if ((await fetch(`${baseURL}/register`, { signal: AbortSignal.timeout(5000) })).ok) { ready = true; break; }
        } catch { /* May still be starting. */ }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, "Isolated server did not become ready");
    await runNode(["--import", "tsx", options.testFile]);
  } catch (error) {
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    if (server && server.exitCode === null) {
      const stopped = new Promise<void>((resolve) => server!.once("exit", () => resolve()));
      const forceStop = setTimeout(() => server?.kill("SIGKILL"), 10_000);
      server.kill("SIGTERM");
      await stopped;
      clearTimeout(forceStop);
    }
    await control?.end();
    if (created) await administration.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await administration.end();
  }
}
