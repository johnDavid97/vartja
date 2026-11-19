import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Client } from "pg";
import { runIsolatedIntegration } from "./isolated-database";

const execute = promisify(execFile);

async function expectMigrationRefused(database: Client, command: "migrate" | "migrate:down", message: string) {
  const databaseName = (await database.query("SELECT current_database() AS name")).rows[0].name;
  assert.match(databaseName, /^sammen_household_members_test_/);
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  databaseUrl.pathname = `/${databaseName}`;
  await assert.rejects(execute(process.execPath, ["node_modules/payload/bin.js", command], {
    env: { ...process.env, DATABASE_URL: databaseUrl.toString(), NODE_ENV: "production" },
    timeout: 30_000,
  }), (error: unknown) => {
    const failure = error as { stdout?: string; stderr?: string };
    return `${failure.stdout ?? ""}${failure.stderr ?? ""}`.includes(message);
  });
}

try {
  await runIsolatedIntegration({
    name: "household_members", port: 3110,
    migration: "20261119_120845_household_member_rejection",
    // Registration deliberately exhausts durable quotas; authentication/admin suites
    // run in their own databases instead of sharing this test's limiter state.
    testFile: "tests/integration/household-registration.ts",
    async verifyRollback(database) {
      const labels = await database.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'enum_households_members_status'::regtype ORDER BY enumsortorder");
      assert.deepEqual(labels.rows.map((row) => row.enumlabel), ["pending", "approved"]);
      for (const status of ["pending", "approved", "revoked"]) {
        const household = await database.query(`INSERT INTO households
          (display_name, contact_name, email, status, revision, credential_version, session_version,
           public_id, access_code_digest, access_code_encrypted, registration_request_digest, registration_request_fingerprint)
          VALUES ($1, 'Legacy Contact', 'legacy@example.invalid', $2, 7, 3, 4, $1, $1, $1, $1, $1) RETURNING id`,
        [`legacy-member-${status}`, status]);
        const memberStatus = status === "pending" ? "pending" : "approved";
        await database.query(`INSERT INTO households_members (_order, _parent_id, id, member_id, name, status)
          VALUES (1, $1, $2, $2, 'Legacy Contact', $3)`, [household.rows[0].id, `legacy-row-${status}`, memberStatus]);
      }
      // A legacy manual household decision must never be silently reinterpreted.
      await database.query("UPDATE households_members SET status = 'approved' WHERE id = 'legacy-row-pending'");
      await expectMigrationRefused(database, "migrate", "Household approval conflicts with member approvals");
      assert.equal((await database.query("SELECT status FROM households WHERE public_id = 'legacy-member-pending'")).rows[0].status, "pending");
      await database.query("UPDATE households_members SET status = 'pending' WHERE id = 'legacy-row-pending'");
    },
    async verifyReapply(database) {
      const households = await database.query(`SELECT h.public_id, h.status, h.revision, h.credential_version,
        h.session_version, h.access_code_digest, m.member_id, m.status AS member_status
        FROM households h JOIN households_members m ON m._parent_id = h.id
        WHERE h.public_id LIKE 'legacy-member-%' ORDER BY h.public_id`);
      assert.equal(households.rowCount, 3);
      for (const row of households.rows) {
        assert.equal(row.member_status, row.status);
        assert.equal(row.member_id, `legacy-row-${row.status}`);
        assert.equal(row.access_code_digest, row.public_id);
        assert.equal(Number(row.revision), 7);
        assert.equal(Number(row.credential_version), 3);
        assert.equal(Number(row.session_version), 4);
      }
      // Exercise the actual rollback guard against this disposable database only.
      await expectMigrationRefused(database, "migrate:down", "Cannot roll back while rejected members exist");
      assert.equal((await database.query("SELECT count(*)::int AS count FROM households_members WHERE status = 'revoked'")).rows[0].count, 1);
      await database.query("DELETE FROM households WHERE public_id LIKE 'legacy-member-%'");
      console.log("PASS: existing household access, credentials and member IDs preserved; destructive rollback refused.");
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
