import { connection } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdSummaryServices } from "@/features/households/composition-root";
import { requireHouseholdAdministrator } from "@/features/households/http/administrator";
import { householdErrorResponse, householdResponse } from "@/features/households/http/requests";

export async function GET(request: Request) {
  // Authentication and database initialization need runtime secrets, never build-time access.
  await connection();
  try {
    const payload = await getPayload({ config });
    await requireHouseholdAdministrator(payload, request.headers);
    return householdResponse(await getHouseholdSummaryServices(payload).get());
  } catch (error) {
    return householdErrorResponse(error);
  }
}
