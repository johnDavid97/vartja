import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdRegistrationServices } from "@/features/households/composition-root";
import { requireHouseholdAdministrator } from "@/features/households/http/administrator";
import { HouseholdRequestError, householdErrorResponse, householdResponse, readHouseholdRequest } from "@/features/households/http/requests";

function validateCodeRequest(input: unknown): { householdId: number; action: "reveal" | "rotate" } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new HouseholdRequestError(400, "Ugyldig forespørsel.");
  }
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).length !== 2 || typeof fields.householdId !== "number"
    || !Number.isSafeInteger(fields.householdId) || fields.householdId < 1
    || fields.householdId > 2_147_483_647 || (fields.action !== "reveal" && fields.action !== "rotate")) {
    throw new HouseholdRequestError(400, "Velg en gyldig husstand og handling.");
  }
  return { householdId: fields.householdId, action: fields.action };
}

export async function POST(request: Request) {
  try {
    const submittedAction = validateCodeRequest(await readHouseholdRequest(request, 1024));
    const payload = await getPayload({ config });
    const administratorId = await requireHouseholdAdministrator(payload, request.headers);
    const { codes } = getHouseholdRegistrationServices(payload);
    const accessCode = submittedAction.action === "rotate"
      ? await codes.rotate(submittedAction.householdId, administratorId)
      : await codes.reveal(submittedAction.householdId, administratorId);
    return householdResponse({ accessCode });
  } catch (error) {
    return householdErrorResponse(error);
  }
}
