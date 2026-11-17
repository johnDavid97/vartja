import type { Payload } from "payload";
import { HouseholdRequestError } from "./requests";

/** Household guests are never treated as Payload administrators. */
export async function requireHouseholdAdministrator(payload: Payload, headers: Headers): Promise<number> {
  const { user } = await payload.auth({ headers });
  if (!user || user.collection !== "users") {
    throw new HouseholdRequestError(403, "Du må være logget inn som administrator.");
  }
  return user.id;
}
