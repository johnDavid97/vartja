import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

try {
  await runIsolatedIntegration({
    name: "households", port: 3103,
    migration: "20261117_140805_household_registration",
    testFile: "tests/integration/household-registration.ts",
    async verifyRollback(database) {
      const result = await database.query("SELECT to_regclass('households') AS table_name");
      assert.equal(result.rows[0].table_name, null);
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
