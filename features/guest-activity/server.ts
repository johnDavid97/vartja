import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { getHouseholdAuthServices } from "@/features/households/auth/composition-root";
import { sessionTokenFromHeaders } from "@/features/households/http/session-cookie";
import { HouseholdRequestError, householdResponse } from "@/features/households/http/requests";
import { ActivityRateLimitExceededError, consumeActivityAttempt } from "./rate-limit";

export { activityDigest } from "./digest";

export type ActivityViewer = { kind: "household" | "administrator"; id: number; name: string };
export interface GuestActivityContext { payload: Payload; viewer: ActivityViewer }

export async function activityViewer(payload: Payload, headers: Headers): Promise<ActivityViewer> {
  const { user } = await payload.auth({ headers });
  if (user?.collection === "users") return { kind: "administrator", id: user.id, name: user.name || "Brudeparet" };
  const session = await getHouseholdAuthServices(payload).resolve(sessionTokenFromHeaders(headers));
  if (session?.status !== "approved") throw new HouseholdRequestError(403, "Logg inn med en godkjent husstand.");
  return { kind: "household", id: session.householdId, name: session.displayName };
}

/** Durable per-author write quota. Consumed outside the content transaction, including failed attempts. */
export async function limitActivity(context: GuestActivityContext): Promise<void> {
  try {
    await consumeActivityAttempt(context.payload, context.viewer);
  } catch (error) {
    if (error instanceof ActivityRateLimitExceededError) {
      throw new HouseholdRequestError(429, "Du har sendt mange svar. Vent litt og prøv igjen.");
    }
    throw error;
  }
}

export async function guestActivityResponse(request: Request, action: (context: GuestActivityContext) => Promise<unknown>) {
  try {
    const payload = await getPayload({ config });
    const viewer = await activityViewer(payload, request.headers);
    const response = householdResponse(await action({ payload, viewer }));
    response.headers.set("Vary", "Cookie");
    return response;
  } catch (error) {
    if (error instanceof HouseholdRequestError) return householdResponse({ error: error.message }, error.status);
    return householdResponse({ error: "Kunne ikke fullføre forespørselen. Prøv igjen." }, 503);
  }
}
