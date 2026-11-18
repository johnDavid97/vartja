import assert from "node:assert/strict";
import { runIsolatedIntegration } from "./isolated-database";

try {
  await runIsolatedIntegration({
    name: "homepage", port: 3104,
    migration: "20261117_211959_homepage_appearance",
    testFile: "tests/integration/homepage.ts",
    async verifyRollback(database) {
      const columns = await database.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'wedding' AND column_name LIKE 'hero_%'");
      assert.equal(columns.rowCount, 0);
      await database.query("INSERT INTO wedding (couple_names, wedding_date, welcome_message, venue) VALUES ($1, $2, $3, $4)", ["Existing Couple", "2027-07-27T10:00:00Z", "Keep this welcome", "Keep this venue"]);
    },
    async verifyReapply(database) {
      const result = await database.query("SELECT couple_names, welcome_message, venue, hero_background_color FROM wedding");
      assert.deepEqual(result.rows[0], { couple_names: "Existing Couple", welcome_message: "Keep this welcome", venue: "Keep this venue", hero_background_color: "#3c4641" });
    },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
