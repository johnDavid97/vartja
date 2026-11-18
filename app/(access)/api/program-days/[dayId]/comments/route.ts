import { activityResponse, limitActivity } from "@/features/program/activity/server";
import { createComment, moderateComment, readComments } from "@/features/program/activity/comments";
import { HouseholdRequestError, readHouseholdRequest } from "@/features/households/http/requests";

type Context = { params: Promise<{ dayId: string }> };
export async function GET(request: Request, { params }: Context) {
  return activityResponse(request, (await params).dayId, async (context) => {
    const raw = new URL(request.url).searchParams.get("after") ?? "0";
    if (!/^\d{1,10}$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 2147483647) throw new HouseholdRequestError(400, "Ugyldig side.");
    return readComments(context, Number(raw));
  });
}
export async function POST(request: Request, { params }: Context) {
  return activityResponse(request, (await params).dayId, async (context) => {
    const input = await readHouseholdRequest(request, 12000);
    await limitActivity(context);
    return createComment(context, input);
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return activityResponse(request, (await params).dayId, async (context) => {
    const input = await readHouseholdRequest(request, 1024);
    await limitActivity(context);
    return moderateComment(context, input);
  });
}
