import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";
import type { Clock } from "../application/HouseholdCodeServices";
import type { RegistrationAttemptLimiter } from "../application/HouseholdRegistration";

type DrizzleResult = { rows?: unknown[] } | unknown[];
type PayloadWithDrizzle = Payload & {
  db: { drizzle: { execute(query: unknown): Promise<DrizzleResult> } };
};

function returnedRows(result: DrizzleResult): unknown[] {
  if (Array.isArray(result)) return result;
  return result.rows ?? [];
}

/**
 * Durable global protection. It deliberately does not use IP addresses: the app
 * need not trust proxy headers, at the cost of one abusive client consuming the
 * shared allowance. The migration must create `household_registration_limits`
 * with Payload columns: id, window_key (unique), window_start, attempts and
 * created_at/updated_at.
 */
export class PostgresRegistrationAttemptLimiter implements RegistrationAttemptLimiter {
  private readonly database: PayloadWithDrizzle["db"]["drizzle"];

  constructor(
    payload: Payload,
    private readonly clock: Clock,
    private readonly maximumAttempts = 100,
  ) {
    this.database = (payload as PayloadWithDrizzle).db.drizzle;
  }

  async consume(): Promise<boolean> {
    const now = this.clock.now();
    const windowStart = new Date(now);
    windowStart.setUTCSeconds(0, 0);
    const windowKey = windowStart.toISOString();

    const result = await this.database.execute(sql`
      INSERT INTO "household_registration_limits"
        ("window_key", "window_start", "attempts", "created_at", "updated_at")
      VALUES (${windowKey}, ${windowStart}, 1, ${now}, ${now})
      ON CONFLICT ("window_key") DO UPDATE
        SET "attempts" = "household_registration_limits"."attempts" + 1,
            "updated_at" = EXCLUDED."updated_at"
        WHERE "household_registration_limits"."attempts" < ${this.maximumAttempts}
      RETURNING "id"
    `);

    // Keep cleanup work bounded; old rows are operational counters, not an audit log.
    const cleanupBefore = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000);
    await this.database.execute(sql`
      DELETE FROM "household_registration_limits"
      WHERE "id" IN (
        SELECT "id" FROM "household_registration_limits"
        WHERE "window_start" < ${cleanupBefore}
        ORDER BY "window_start" ASC
        LIMIT 100
      )
    `);

    return returnedRows(result).length === 1;
  }
}
