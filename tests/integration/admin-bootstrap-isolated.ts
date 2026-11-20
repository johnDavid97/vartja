import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { runIsolatedIntegration } from "./isolated-database";

async function assertNoPasswordColumn(database: import("pg").Client): Promise<void> {
  const result = await database.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
      AND column_name = 'password'
  `);
  assert.equal(result.rowCount, 0, "The users table must never acquire a plaintext password column");
}

// Bootstrap tests must never inherit the populated site's authentication secrets.
process.env.PAYLOAD_SECRET = randomBytes(32).toString("hex");
process.env.HOUSEHOLD_ACCESS_SECRET = randomBytes(32).toString("hex");

try {
  await runIsolatedIntegration({
    name: "admin_bootstrap",
    port: 3118,
    migration: "20261119_152048_remove_legacy_schedule",
    testFile: "tests/integration/admin-bootstrap.ts",
    verifyRollback: assertNoPasswordColumn,
    verifyReapply: assertNoPasswordColumn,
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
