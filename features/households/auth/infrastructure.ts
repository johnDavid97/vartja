import { createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";
import type { HouseholdSession } from "./models";
import type {
  Clock,
  HouseholdSessionRepository,
  LoginAttemptLimiter,
  LoginHouseholdSnapshot,
  TokenSource,
} from "./ports";

const derivationSalt = Buffer.from("sammen/household-access/v1", "utf8");
type DrizzleResult = { rows?: unknown[] } | unknown[];
type Database = { execute(query: unknown): Promise<DrizzleResult> };
type PayloadWithDrizzle = Payload & { db: { drizzle: Database } };

function rows(result: DrizzleResult): Record<string, unknown>[] {
  const values = Array.isArray(result) ? result : result.rows ?? [];
  return values.filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null);
}

function derive(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), derivationSalt, Buffer.from(purpose), 32));
}

function hmac(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("base64url");
}

export class SecureSessionTokens implements TokenSource {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }

  digest(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("base64url");
  }
}

export class PostgresLoginAttemptLimiter implements LoginAttemptLimiter {
  private readonly database: Database;
  private readonly globalKey: Buffer;
  private readonly nameKey: Buffer;

  constructor(payload: Payload, secret: string, private readonly clock: Clock) {
    this.database = (payload as PayloadWithDrizzle).db.drizzle;
    this.globalKey = derive(secret, "login-rate-global-bucket");
    this.nameKey = derive(secret, "login-rate-name-bucket");
  }

  async consume(normalizedName: string): Promise<boolean> {
    const now = this.clock.now();
    const windowStart = new Date(now);
    windowStart.setUTCSeconds(0, 0);
    const globalDigest = hmac(this.globalKey, "global");
    const nameDigest = hmac(this.nameKey, normalizedName);

    // Both counters are consumed in one statement. A saturated bucket returns no row.
    const result = await this.database.execute(sql`
      WITH global_bucket AS (
        INSERT INTO "household_login_limits"
          ("bucket_digest", "window_start", "attempts", "created_at", "updated_at")
        VALUES (${globalDigest}, ${windowStart}, 1, ${now}, ${now})
        ON CONFLICT ("bucket_digest") DO UPDATE SET
          "window_start" = EXCLUDED."window_start",
          "attempts" = CASE
            WHEN "household_login_limits"."window_start" < EXCLUDED."window_start" THEN 1
            ELSE "household_login_limits"."attempts" + 1
          END,
          "updated_at" = EXCLUDED."updated_at"
        WHERE "household_login_limits"."window_start" < EXCLUDED."window_start"
           OR "household_login_limits"."attempts" < 200
        RETURNING "id"
      ), name_bucket AS (
        INSERT INTO "household_login_limits"
          ("bucket_digest", "window_start", "attempts", "created_at", "updated_at")
        SELECT ${nameDigest}, ${windowStart}, 1, ${now}, ${now}
        FROM global_bucket WHERE true
        ON CONFLICT ("bucket_digest") DO UPDATE SET
          "window_start" = EXCLUDED."window_start",
          "attempts" = CASE
            WHEN "household_login_limits"."window_start" < EXCLUDED."window_start" THEN 1
            ELSE "household_login_limits"."attempts" + 1
          END,
          "updated_at" = EXCLUDED."updated_at"
        WHERE "household_login_limits"."window_start" < EXCLUDED."window_start"
           OR "household_login_limits"."attempts" < 20
        RETURNING "id"
      )
      SELECT
        EXISTS(SELECT 1 FROM global_bucket) AS "globalAllowed",
        EXISTS(SELECT 1 FROM name_bucket) AS "nameAllowed"
    `);

    const outcome = rows(result)[0];
    const allowed = outcome?.globalAllowed === true && outcome?.nameAllowed === true;

    const cleanupBefore = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000);
    await this.database.execute(sql`
      DELETE FROM "household_login_limits"
      WHERE "id" IN (
        SELECT "id" FROM "household_login_limits"
        WHERE "window_start" < ${cleanupBefore}
        ORDER BY "window_start" ASC
        LIMIT 100
      )
    `).catch(() => undefined);
    return allowed;
  }
}

function status(value: unknown): "pending" | "approved" | null {
  return value === "pending" || value === "approved" ? value : null;
}

function sessionFromRow(row: Record<string, unknown> | undefined): HouseholdSession | null {
  const householdStatus = status(row?.status);
  const householdId = Number(row?.householdId);
  if (!row || !Number.isSafeInteger(householdId) || typeof row.displayName !== "string" || !householdStatus) return null;
  return { householdId, displayName: row.displayName, status: householdStatus };
}

export class PostgresHouseholdSessionRepository implements HouseholdSessionRepository {
  private readonly database: Database;

  constructor(payload: Payload) {
    this.database = (payload as PayloadWithDrizzle).db.drizzle;
  }

  async findByCredentialDigest(digest: string): Promise<LoginHouseholdSnapshot | null> {
    const result = await this.database.execute(sql`
      SELECT "id" AS "householdId", "display_name" AS "displayName", "status",
             "access_code_digest" AS "credentialDigest",
             "credential_version" AS "credentialVersion", "session_version" AS "sessionVersion"
      FROM "households"
      WHERE "access_code_digest" = ${digest}
        AND "status" IN ('pending', 'approved')
      LIMIT 1
    `);
    const row = rows(result)[0];
    const household = sessionFromRow(row);
    const credentialVersion = Number(row?.credentialVersion);
    const sessionVersion = Number(row?.sessionVersion);
    if (!household || !Number.isSafeInteger(credentialVersion) || !Number.isSafeInteger(sessionVersion) || row?.credentialDigest !== digest) {
      return null;
    }
    return { ...household, credentialDigest: digest, credentialVersion, sessionVersion };
  }

  async createIfUnchanged(input: {
    household: LoginHouseholdSnapshot;
    tokenDigest: string;
    expiresAt: Date;
    now: Date;
  }): Promise<HouseholdSession | null> {
    const household = input.household;
    const result = await this.database.execute(sql`
      INSERT INTO "household_sessions"
        ("token_digest", "household_id", "credential_version", "session_version", "expires_at", "created_at", "updated_at")
      SELECT ${input.tokenDigest}, h."id", h."credential_version", h."session_version", ${input.expiresAt}, ${input.now}, ${input.now}
      FROM "households" h
      WHERE h."id" = ${household.householdId}
        AND h."display_name" = ${household.displayName}
        AND h."status" = ${household.status}
        AND h."status" IN ('pending', 'approved')
        AND h."access_code_digest" = ${household.credentialDigest}
        AND h."credential_version" = ${household.credentialVersion}
        AND h."session_version" = ${household.sessionVersion}
      RETURNING "id"
    `);
    return rows(result).length === 1
      ? { householdId: household.householdId, displayName: household.displayName, status: household.status }
      : null;
  }

  async resolve(tokenDigest: string, now: Date): Promise<HouseholdSession | null> {
    const result = await this.database.execute(sql`
      SELECT h."id" AS "householdId", h."display_name" AS "displayName", h."status"
      FROM "household_sessions" s
      INNER JOIN "households" h ON h."id" = s."household_id"
      WHERE s."token_digest" = ${tokenDigest}
        AND s."expires_at" > ${now}
        AND s."credential_version" = h."credential_version"
        AND s."session_version" = h."session_version"
        AND h."status" IN ('pending', 'approved')
      LIMIT 1
    `);
    return sessionFromRow(rows(result)[0]);
  }

  async delete(tokenDigest: string): Promise<void> {
    await this.database.execute(sql`
      DELETE FROM "household_sessions" WHERE "token_digest" = ${tokenDigest}
    `);
  }

  async cleanup(now: Date, limit: number): Promise<void> {
    await this.database.execute(sql`
      DELETE FROM "household_sessions"
      WHERE "id" IN (
        SELECT "id" FROM "household_sessions"
        WHERE "expires_at" <= ${now} OR "household_id" IS NULL
        ORDER BY "expires_at" ASC
        LIMIT ${limit}
      )
    `);
  }
}
