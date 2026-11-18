import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

try {
  await runIsolatedIntegration({
    name: "household_login", port: 3107, migration: "20261118_153059_household_login",
    testFile: ["tests/integration/program.ts", "tests/integration/household-login.ts"],
    async verifyRollback(database) {
      assert.equal((await database.query("SELECT to_regclass('household_sessions') AS name")).rows[0].name, null);
      await database.query(`INSERT INTO households (contact_name,email,status,revision,credential_version,public_id,access_code_digest,access_code_encrypted,registration_request_digest,registration_request_fingerprint)
        VALUES ('Legacy Family','legacy@example.invalid','approved',7,3,'legacy-id','legacy-digest','legacy-encrypted','legacy-request','legacy-fingerprint')`);
    },
    async verifyReapply(database) {
      const row = (await database.query("SELECT display_name,session_version,revision,credential_version,access_code_digest FROM households WHERE public_id='legacy-id'")).rows[0];
      assert.deepEqual(row, { display_name: "Legacy Family", session_version: "1", revision: "7", credential_version: "3", access_code_digest: "legacy-digest" });
      await database.query("DELETE FROM households WHERE public_id='legacy-id'");
    },
  });
} catch (error) { console.error(error); process.exitCode = 1; }
