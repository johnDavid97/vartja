import { activityResponse, limitActivity } from "@/features/program/activity/server";
import { readProgramPoll, voteProgramPoll } from "@/features/program/activity/polls";
import { readHouseholdRequest } from "@/features/households/http/requests";

type Context = { params: Promise<{ dayId: string; pollId: string }> };
export async function GET(request: Request, { params }: Context) {
  const { dayId, pollId } = await params;
  return activityResponse(request, dayId, (context) => readProgramPoll(context, pollId));
}
export async function POST(request: Request, { params }: Context) {
  const { dayId, pollId } = await params;
  return activityResponse(request, dayId, async (context) => {
    const input = await readHouseholdRequest(request, 2048);
    await limitActivity(context);
    return voteProgramPoll(context, pollId, input);
  });
}
