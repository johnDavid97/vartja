import { InvalidInvitationOriginError } from "../domain/invitation-url";
import { HouseholdRegistrationError } from "../application/HouseholdRegistration";

export class HouseholdRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HouseholdRequestError";
  }
}

/** Reject cross-origin mutations and read a bounded body before invoking any use case. */
export async function readHouseholdRequest(request: Pick<Request, "headers"> & Partial<Pick<Request, "url" | "body">>, maximumBytes = 16_384): Promise<unknown> {
  if (!request.url) throw new HouseholdRequestError(403, "Ugyldig forespørsel.");
  const expectedOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HouseholdRequestError(403, "Ugyldig forespørsel. Åpne siden på nytt og prøv igjen.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HouseholdRequestError(415, "Forventet JSON.");
  }
  if (Number(request.headers.get("content-length")) > maximumBytes) {
    throw new HouseholdRequestError(413, "Forespørselen er for stor.");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new HouseholdRequestError(400, "Forespørselen mangler innhold.");
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new HouseholdRequestError(413, "Forespørselen er for stor.");
      }
      chunks.push(value);
    }
    const bodyBytes = Buffer.concat(chunks);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes)) as unknown;
  } catch (error) {
    if (error instanceof HouseholdRequestError) throw error;
    throw new HouseholdRequestError(400, "Kunne ikke lese forespørselen.");
  } finally {
    reader.releaseLock();
  }
}

export function householdResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function householdErrorResponse(error: unknown): Response {
  if (error instanceof InvalidInvitationOriginError) {
    return householdResponse({ error: error.message }, 503);
  }
  if (error instanceof HouseholdRequestError) {
    return householdResponse({ error: error.message }, error.status);
  }
  if (error instanceof HouseholdRegistrationError) {
    return householdResponse({ error: error.message }, error.httpStatus);
  }
  // Do not log registration bodies, codes or database error parameters.
  console.error("Household request failed unexpectedly.");
  return householdResponse({ error: "Noe gikk galt. Prøv igjen senere eller ta kontakt med brudeparet." }, 500);
}
