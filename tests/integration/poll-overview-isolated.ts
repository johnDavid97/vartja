import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

try {
  await runIsolatedIntegration({
    name: "poll_overview", port: 3106,
    migration: "20261025_212144_post_polls",
    testFile: ["tests/integration/poll-overview.ts", "tests/integration/polls.ts", "tests/integration/admin-design.ts"],
    async verifyRollback(database) {
      const result = await database.query("SELECT to_regclass('poll_votes') AS table_name");
      assert.equal(result.rows[0].table_name, null);
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
