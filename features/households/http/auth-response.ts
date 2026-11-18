import { AuthError } from "../auth/errors";
import { HouseholdRequestError, householdResponse } from "./requests";

export function householdAuthErrorResponse(error: unknown): Response {
  if (error instanceof HouseholdRequestError) return householdResponse({ error: error.message }, error.status);
  if (error instanceof AuthError) {
    if (error.code === "INVALID_INPUT" || error.code === "INVALID_CREDENTIALS") {
      return householdResponse({ error: "Vi fant ikke husstanden med dette navnet og koden. Kontroller begge og prøv igjen." }, 401);
    }
    if (error.code === "RATE_LIMITED") {
      const response = householdResponse({ error: "For mange forsøk. Vent litt og prøv igjen." }, 429);
      response.headers.set("Retry-After", "60");
      return response;
    }
  }
  // Never log credentials, tokens, submitted names or SQL error parameters.
  return householdResponse({ error: "Innlogging er midlertidig utilgjengelig. Prøv igjen senere." }, 503);
}
