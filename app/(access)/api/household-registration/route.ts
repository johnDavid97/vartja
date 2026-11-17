import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdRegistrationServices } from "@/features/households/composition-root";
import { householdErrorResponse, householdResponse, readHouseholdRequest } from "@/features/households/http/requests";

export async function POST(request: Request) {
  try {
    const submittedRegistration = await readHouseholdRequest(request);
    const payload = await getPayload({ config });
    const { registration } = getHouseholdRegistrationServices(payload);
    const result = await registration.register(submittedRegistration);
    return householdResponse(result, 201);
  } catch (error) {
    return householdErrorResponse(error);
  }
}
