import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Client } from "pg";
import { runIsolatedIntegration } from "./isolated-database";

async function assertLegacySchedulePresent(database: Client): Promise<void> {
  const result = await database.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.wedding_schedule') AS table_name",
  );
  assert.equal(result.rows[0]?.table_name, "wedding_schedule");
}

async function assertLegacyScheduleRemoved(database: Client): Promise<void> {
  const result = await database.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.wedding_schedule') AS table_name",
  );
  assert.equal(result.rows[0]?.table_name, null);
}

// Never reuse authentication or encryption material from the source environment.
process.env.PAYLOAD_SECRET = randomBytes(32).toString("hex");
process.env.HOUSEHOLD_ACCESS_SECRET = randomBytes(32).toString("hex");

try {
  await runIsolatedIntegration({
    name: "request_security",
    port: 3121,
    migration: "20261119_152048_remove_legacy_schedule",
    testFile: "tests/integration/request-security.ts",
    verifyRollback: assertLegacySchedulePresent,
    verifyReapply: assertLegacyScheduleRemoved,
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
