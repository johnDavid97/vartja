import assert from "node:assert/strict";
import type { Client } from "pg";
import { runIsolatedIntegration } from "./isolated-database";

async function retainedData(database: Client): Promise<Record<string, string>> {
  const { rows } = await database.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('wedding_schedule', 'payload_migrations') ORDER BY tablename",
  );
  const result: Record<string, string> = {};
  for (const { tablename } of rows) {
    const table = `"${tablename.replaceAll('"', '""')}"`;
    const hash = await database.query<{ fingerprint: string }>(
      `SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), '')) AS fingerprint FROM public.${table} t`,
    );
    result[tablename] = hash.rows[0].fingerprint;
  }
  return result;
}

let before: Record<string, string>;
let programFixtureId: number;
let versionFixtureId: number;
try {
  await runIsolatedIntegration({
    name: "legacy_schedule_removal", port: 3113,
    migration: "20261119_152048_remove_legacy_schedule",
    testFile: ["tests/integration/admin-design.ts", "tests/integration/program.ts"],
    async verifyRollback(database) {
      const table = await database.query("SELECT to_regclass('public.wedding_schedule') AS name");
      assert.equal(table.rows[0].name, "wedding_schedule", "Down restores the old schema");
      const empty = await database.query("SELECT count(*)::integer AS count FROM wedding_schedule");
      assert.equal(empty.rows[0].count, 0, "Rollback cannot resurrect deleted entries");
      const wedding = await database.query("INSERT INTO wedding (couple_names) VALUES ('Migration fixture') RETURNING id");
      await database.query(
        "INSERT INTO wedding_schedule (_order, _parent_id, id, title, time, description) VALUES (1, $1, 'legacy-fixture', 'Old timetable fixture', '2026-01-01T12:00:00Z', 'Approved for deletion')",
        [wedding.rows[0].id],
      );
      const itinerary = JSON.stringify({ days: [] });
      programFixtureId = (await database.query("INSERT INTO program (itinerary, _status) VALUES ($1, 'published') RETURNING id", [itinerary])).rows[0].id;
      versionFixtureId = (await database.query("INSERT INTO _program_v (version_itinerary, version__status, latest) VALUES ($1, 'published', true) RETURNING id", [itinerary])).rows[0].id;
      before = await retainedData(database);
    },
    async verifyReapply(database) {
      const table = await database.query("SELECT to_regclass('public.wedding_schedule') AS name");
      assert.equal(table.rows[0].name, null, "Up permanently removes the obsolete table and its rows");
      assert.deepEqual(await retainedData(database), before, "All retained table contents, including Program and its versions, must remain unchanged");
      console.log("PASS: populated legacy timetable removed; all retained table fingerprints unchanged; rollback restores empty schema only.");
      // Remove only our disposable preservation fixtures after verification. The separate
      // Program browser suite correctly refuses to run over existing version history.
      await database.query("DELETE FROM _program_v WHERE id = $1", [versionFixtureId]);
      await database.query("DELETE FROM program WHERE id = $1", [programFixtureId]);
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
