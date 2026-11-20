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
  assert.equal(result.rowCount, 0, "The users table must store only password hashes, never a password column");
}

// Never reuse the populated site's authentication/encryption secrets for mutation fixtures.
process.env.PAYLOAD_SECRET = randomBytes(32).toString("hex");
process.env.HOUSEHOLD_ACCESS_SECRET = randomBytes(32).toString("hex");

try {
  await runIsolatedIntegration({
    name: "admin_security",
    port: 3117,
    migration: "20261119_152048_remove_legacy_schedule",
    testFile: "tests/integration/admin-security.ts",
    verifyRollback: assertNoPasswordColumn,
    verifyReapply: assertNoPasswordColumn,
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
