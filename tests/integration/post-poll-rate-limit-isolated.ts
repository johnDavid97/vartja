import { randomBytes } from "node:crypto";
import { runIsolatedIntegration } from "./isolated-database";

process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
process.env.HOUSEHOLD_ACCESS_SECRET = randomBytes(48).toString("base64url");

try {
  await runIsolatedIntegration({
    name: "post_poll_rate_limit",
    port: 3122,
    migration: "20261118_181836_program_day_activity",
    testFile: "tests/integration/post-poll-rate-limit.ts",
    async verifyRollback(database) {
      const table = await database.query("SELECT to_regclass('program_activity_limits') AS name");
      if (table.rows[0].name !== null) throw new Error("Rate-limit table should be removed by its owning migration rollback");
    },
    async verifyReapply(database) {
      const table = await database.query("SELECT to_regclass('program_activity_limits') AS name");
      if (table.rows[0].name !== "program_activity_limits") throw new Error("Rate-limit table was not restored");
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
