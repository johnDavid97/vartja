import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { runIsolatedIntegration } from "./isolated-database";

// This runner's server and browser test share disposable cryptographic keys without
// exposing or deriving invitation data from the parent environment.
process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
process.env.HOUSEHOLD_ACCESS_SECRET = randomBytes(48).toString("base64url");

try {
  await runIsolatedIntegration({
    name: "wedding_routing",
    port: 3114,
    migration: "20261119_152048_remove_legacy_schedule",
    testFile: [
      "tests/integration/wedding-routing.ts",
      "tests/integration/vartja-landing.ts",
    ],
    async verifyRollback(database) {
      const migration = await database.query(
        "SELECT 1 FROM payload_migrations WHERE name = $1",
        ["20261119_152048_remove_legacy_schedule"],
      );
      assert.equal(migration.rowCount, 0, "The target migration must be rolled back before reapplication");
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
