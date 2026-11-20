import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";
import { activityDigest } from "./digest";

export const ACTIVITY_ATTEMPTS_PER_MINUTE = 20;

export type ActivityRateLimitActor = { kind: "household" | "administrator"; id: number };

type RateLimitPayload = Pick<Payload, "config" | "db">;

export class ActivityRateLimitExceededError extends Error {
  constructor() {
    super("Activity rate limit exceeded");
    this.name = "ActivityRateLimitExceededError";
  }
}

export function activityRateLimitBucket(payload: Pick<Payload, "config">, purpose: string, actor: ActivityRateLimitActor): string {
  return activityDigest(payload, purpose, [actor.kind, actor.id]);
}

/**
 * Atomically consumes one durable attempt in a database-clock minute.
 * Failed and concurrent writes still consume attempts; this is not an exactly-once counter.
 */
export async function consumeActivityAttempt(
  payload: RateLimitPayload,
  actor: ActivityRateLimitActor,
  purpose = "write-quota",
): Promise<void> {
  const bucket = activityRateLimitBucket(payload, purpose, actor);
  const result = await payload.db.drizzle.execute(sql`
    INSERT INTO program_activity_limits (bucket_digest, window_start, attempts, created_at, updated_at)
    VALUES (${bucket}, date_trunc('minute', now()), 1, now(), now())
    ON CONFLICT (bucket_digest) DO UPDATE SET
      window_start = EXCLUDED.window_start,
      attempts = CASE WHEN program_activity_limits.window_start < EXCLUDED.window_start THEN 1 ELSE program_activity_limits.attempts + 1 END,
      updated_at = now()
    WHERE program_activity_limits.window_start < EXCLUDED.window_start OR program_activity_limits.attempts < ${ACTIVITY_ATTEMPTS_PER_MINUTE}
    RETURNING id
  `);
  if (!result.rows.length) throw new ActivityRateLimitExceededError();
}
