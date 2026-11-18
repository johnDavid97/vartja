import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

try {
  await runIsolatedIntegration({
    name: "program_activity", port: 3108, migration: "20261118_181836_program_day_activity",
    testFile: ["tests/integration/program.ts", "tests/integration/program-activity.ts"],
    async verifyRollback(database) { assert.equal((await database.query("SELECT to_regclass('program_comments') AS name")).rows[0].name, null); },
  });
} catch (error) { console.error(error); process.exitCode = 1; }
