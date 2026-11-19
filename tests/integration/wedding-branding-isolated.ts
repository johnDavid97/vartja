import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { runIsolatedIntegration } from "./isolated-database";

// The disposable server and browser process share fresh test-only keys. Never inherit
// invitation or household credential material from the source installation.
process.env.PAYLOAD_SECRET = randomBytes(48).toString("base64url");
process.env.HOUSEHOLD_ACCESS_SECRET = randomBytes(48).toString("base64url");

try {
  await runIsolatedIntegration({
    name: "wedding_branding",
    port: 3115,
    migration: "20261119_152048_remove_legacy_schedule",
    testFile: "tests/integration/wedding-branding.ts",
    async verifyRollback(database) {
      const migration = await database.query(
        "SELECT 1 FROM payload_migrations WHERE name = $1",
        ["20261119_152048_remove_legacy_schedule"],
      );
      assert.equal(migration.rowCount, 0, "The latest migration must be rolled back before reapplication");
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
