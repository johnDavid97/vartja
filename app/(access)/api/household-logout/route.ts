import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdAuthServices } from "@/features/households/auth/composition-root";
import { readHouseholdRequest, householdResponse } from "@/features/households/http/requests";
import { householdAuthErrorResponse } from "@/features/households/http/auth-response";
import { expiredSessionCookie, sessionTokenFromHeaders } from "@/features/households/http/session-cookie";

export async function POST(request: Request) {
  try {
    await readHouseholdRequest(request, 256);
    const token = sessionTokenFromHeaders(request.headers);
    if (token) await getHouseholdAuthServices(await getPayload({ config })).logout(token);
    const response = householdResponse({ success: true });
    response.headers.set("Set-Cookie", expiredSessionCookie(request.url));
    return response;
  } catch (error) { return householdAuthErrorResponse(error); }
}
