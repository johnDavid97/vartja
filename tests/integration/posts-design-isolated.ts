import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

async function memberStatusValues(database: import("pg").Client): Promise<string[]> {
  const result = await database.query<{ enumlabel: string }>(`
    SELECT value.enumlabel
    FROM pg_type type
    JOIN pg_enum value ON value.enumtypid = type.oid
    WHERE type.typname = 'enum_households_members_status'
    ORDER BY value.enumsortorder
  `);
  return result.rows.map(({ enumlabel }) => enumlabel);
}

try {
  await runIsolatedIntegration({
    name: "posts_design",
    port: 3111,
    migration: "20261119_120845_household_member_rejection",
    testFile: "tests/integration/posts-design.ts",
    async verifyRollback(database) {
      assert.deepEqual(await memberStatusValues(database), ["pending", "approved"]);
    },
    async verifyReapply(database) {
      assert.deepEqual(await memberStatusValues(database), ["pending", "approved", "revoked"]);
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
