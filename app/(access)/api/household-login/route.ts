import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdAuthServices } from "@/features/households/auth/composition-root";
import { readHouseholdRequest, householdResponse } from "@/features/households/http/requests";
import { householdAuthErrorResponse } from "@/features/households/http/auth-response";
import { sessionCookie, sessionTokenFromHeaders } from "@/features/households/http/session-cookie";

export async function POST(request: Request) {
  try {
    const input = await readHouseholdRequest(request, 2048);
    const services = getHouseholdAuthServices(await getPayload({ config }));
    const login = await services.login(input);
    await services.logout(sessionTokenFromHeaders(request.headers));
    const response = householdResponse({ household: login.household });
    response.headers.set("Set-Cookie", sessionCookie(login.token, request.url, login.remember ? login.expiresAt : undefined));
    return response;
  } catch (error) { return householdAuthErrorResponse(error); }
}
