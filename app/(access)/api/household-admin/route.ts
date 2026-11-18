import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdAdminServices } from "@/features/households/composition-root";
import { requireHouseholdAdministrator } from "@/features/households/http/administrator";
import { householdErrorResponse, householdResponse, readHouseholdRequest } from "@/features/households/http/requests";

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config });
    const administratorId = await requireHouseholdAdministrator(payload, request.headers);
    const input = await readHouseholdRequest(request);
    const result = await getHouseholdAdminServices(payload).create(input, administratorId);
    return householdResponse(result, 201);
  } catch (error) {
    return householdErrorResponse(error);
  }
}
