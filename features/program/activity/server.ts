import { createHmac } from "node:crypto";
import { sql } from "@payloadcms/db-postgres";
import { getPayload, type Payload, type PayloadRequest } from "payload";
import config from "@payload-config";
import { getHouseholdAuthServices } from "@/features/households/auth/composition-root";
import { sessionTokenFromHeaders } from "@/features/households/http/session-cookie";
import { HouseholdRequestError, householdResponse } from "@/features/households/http/requests";
import { programError, type ProgramData, type ProgramDay } from "@/lib/program";
import { validDayId } from "./validation";

export type ActivityViewer = { kind: "household" | "administrator"; id: number; name: string };
export interface ActivityContext { payload: Payload; viewer: ActivityViewer; dayId: string }

export function activityDigest(payload: Payload, purpose: string, value: unknown): string {
  return createHmac("sha256", payload.config.secret).update(JSON.stringify(["program-activity-v1", purpose, value])).digest("hex");
}

export async function activityViewer(payload: Payload, headers: Headers): Promise<ActivityViewer> {
  const { user } = await payload.auth({ headers });
  if (user?.collection === "users") return { kind: "administrator", id: user.id, name: user.name || "Brudeparet" };
  const session = await getHouseholdAuthServices(payload).resolve(sessionTokenFromHeaders(headers));
  if (session?.status !== "approved") throw new HouseholdRequestError(403, "Logg inn med en godkjent husstand.");
  return { kind: "household", id: session.householdId, name: session.displayName };
}

export async function publishedDay(context: ActivityContext, req?: PayloadRequest): Promise<ProgramDay> {
  const program = await context.payload.findGlobal({ slug: "program", draft: false, depth: 0, overrideAccess: true, req });
  if (program._status !== "published" || programError(program.itinerary, true)) throw new HouseholdRequestError(404, "Fant ikke programdagen.");
  const day = (program.itinerary as ProgramData).days.find((candidate) => candidate.id === context.dayId);
  if (!day) throw new HouseholdRequestError(404, "Fant ikke programdagen.");
  return day;
}

/** Durable per-author write quota. Consumed outside the content transaction, including failed attempts. */
export async function limitActivity(context: ActivityContext): Promise<void> {
  const bucket = activityDigest(context.payload, "write-quota", [context.viewer.kind, context.viewer.id]);
  const result = await context.payload.db.drizzle.execute(sql`
    INSERT INTO program_activity_limits (bucket_digest, window_start, attempts, created_at, updated_at)
    VALUES (${bucket}, date_trunc('minute', now()), 1, now(), now())
    ON CONFLICT (bucket_digest) DO UPDATE SET
      window_start = EXCLUDED.window_start,
      attempts = CASE WHEN program_activity_limits.window_start < EXCLUDED.window_start THEN 1 ELSE program_activity_limits.attempts + 1 END,
      updated_at = now()
    WHERE program_activity_limits.window_start < EXCLUDED.window_start OR program_activity_limits.attempts < 20
    RETURNING id
  `);
  if (!result.rows.length) throw new HouseholdRequestError(429, "Du har sendt mange svar. Vent litt og prøv igjen.");
}

export async function activityResponse(request: Request, dayId: string, action: (context: ActivityContext) => Promise<unknown>) {
  try {
    if (!validDayId(dayId)) throw new HouseholdRequestError(404, "Fant ikke programdagen.");
    const payload = await getPayload({ config });
    const viewer = await activityViewer(payload, request.headers);
    const response = householdResponse(await action({ payload, viewer, dayId }));
    response.headers.set("Vary", "Cookie");
    return response;
  } catch (error) {
    if (error instanceof HouseholdRequestError) return householdResponse({ error: error.message }, error.status);
    return householdResponse({ error: "Kunne ikke fullføre forespørselen. Prøv igjen." }, 503);
  }
}
