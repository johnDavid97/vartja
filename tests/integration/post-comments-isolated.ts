import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

try {
  await runIsolatedIntegration({
    name: "post_comments", port: 3109, migration: "20261118_194840_post_comments",
    testFile: ["tests/integration/program.ts", "tests/integration/post-comments.ts"],
    async verifyRollback(database) {
      await database.query(`INSERT INTO program_comments(day_id,day_label,author_name,body,status,request_digest,request_fingerprint)
        VALUES ('legacy-day','Legacy day','Legacy household','Preserve this comment','hidden','migration-fixture','unchanged-fingerprint')`);
    },
    async verifyReapply(database) {
      const record = (await database.query("SELECT source,day_id,post_id,author_name,body,status,request_fingerprint FROM program_comments WHERE request_digest='migration-fixture'")).rows[0];
      assert.deepEqual(record, { source: "program-day", day_id: "legacy-day", post_id: null, author_name: "Legacy household", body: "Preserve this comment", status: "hidden", request_fingerprint: "unchanged-fingerprint" });
      await database.query("DELETE FROM program_comments WHERE request_digest='migration-fixture'");
    },
  });
} catch (error) { console.error(error); process.exitCode = 1; }
