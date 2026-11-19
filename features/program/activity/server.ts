import type { PayloadRequest } from "payload";
import { HouseholdRequestError } from "@/features/households/http/requests";
import { programError, type ProgramData, type ProgramDay } from "@/lib/program";
import { guestActivityResponse, type GuestActivityContext } from "@/features/guest-activity/server";

export { activityDigest, limitActivity } from "@/features/guest-activity/server";
export interface ActivityContext extends GuestActivityContext { dayId: string }

export async function publishedDay(context: ActivityContext, req?: PayloadRequest): Promise<ProgramDay> {
  const program = await context.payload.findGlobal({ slug: "program", draft: false, depth: 0, overrideAccess: true, req });
  if (program._status !== "published" || programError(program.itinerary, true)) throw new HouseholdRequestError(404, "Fant ikke programdagen.");
  const day = (program.itinerary as ProgramData).days.find((candidate) => candidate.id === context.dayId);
  if (!day) throw new HouseholdRequestError(404, "Fant ikke programdagen.");
  return day;
}

export function activityResponse(request: Request, dayId: string, action: (context: ActivityContext) => Promise<unknown>) {
  return guestActivityResponse(request, (context) => {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(dayId)) throw new HouseholdRequestError(404, "Fant ikke programdagen.");
    return action({ ...context, dayId });
  });
}
