import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

try {
  await runIsolatedIntegration({
    name: "household_admin", port: 3105,
    migration: "20261117_140805_household_registration",
    testFile: [
      "tests/integration/household-admin.ts",
      "tests/integration/admin-design.ts",
      "tests/integration/visual-editor.ts",
      "tests/integration/polls.ts",
    ],
    async verifyRollback(database) {
      const result = await database.query("SELECT to_regclass('households') AS table_name");
      assert.equal(result.rows[0].table_name, null);
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
