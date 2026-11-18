import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import type { Payload } from "payload";
import { getHouseholdAdminServices, getHouseholdRegistrationServices } from "../../features/households/composition-root";

interface AuthenticatedGuestOptions {
  payload: Payload;
  context: BrowserContext;
  administratorId: number;
  baseURL: string;
}

/** Create one approved household and let Playwright retain its opaque session cookie. */
export async function createAuthenticatedGuest({ payload, context, administratorId, baseURL }: AuthenticatedGuestOptions) {
  const fixtureId = randomUUID();
  const displayName = `Testhusstand ${fixtureId}`;
  const { householdId } = await getHouseholdAdminServices(payload).create({
    requestKey: fixtureId,
    contactName: "Testgjest",
    email: `guest-${fixtureId}@example.invalid`,
    additionalMembers: [],
    displayName,
  }, administratorId);

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    await payload.delete({ collection: "households", id: householdId, overrideAccess: true });
    cleaned = true;
  };

  try {
    const accessCode = await getHouseholdRegistrationServices(payload).codes.reveal(householdId, administratorId);
    const response = await context.request.post("/api/household-login", {
      headers: { Origin: new URL(baseURL).origin },
      data: { householdName: displayName, accessCode, remember: false },
    });
    assert(response.ok(), `Approved household login failed (${response.status()}): ${await response.text()}`);
    return { householdId, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
