import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdAuthServices } from "@/features/households/auth/composition-root";
import { householdResponse } from "@/features/households/http/requests";
import { householdAuthErrorResponse } from "@/features/households/http/auth-response";
import { sessionTokenFromHeaders } from "@/features/households/http/session-cookie";

export async function GET(request: Request) {
  try {
    const token = sessionTokenFromHeaders(request.headers);
    const household = token ? await getHouseholdAuthServices(await getPayload({ config })).resolve(token) : null;
    return householdResponse({ household });
  } catch (error) { return householdAuthErrorResponse(error); }
}
