import type { PayloadRequest, Where } from "payload";
import { HouseholdRequestError } from "@/features/households/http/requests";
import type { PollDefinition, PollResults } from "@/lib/polls";
import { activityDigest, publishedDay, type ActivityContext } from "./server";
import { guestActivityTransaction } from "@/features/guest-activity/transaction";

function voterKey(context: ActivityContext, pollId: string) {
  return activityDigest(context.payload, "household-ballot", [context.dayId, pollId, context.viewer.kind, context.viewer.id]);
}
async function pollForDay(context: ActivityContext, pollId: string, req?: PayloadRequest) {
  const day = await publishedDay(context, req);
  const poll = day.polls?.find((candidate) => candidate.id === pollId);
  if (!poll) throw new HouseholdRequestError(404, "Fant ikke avstemningen.");
  return poll;
}
async function results(context: ActivityContext, poll: PollDefinition, req?: PayloadRequest): Promise<PollResults> {
  const base: Where = { and: [{ dayId: { equals: context.dayId } }, { pollId: { equals: poll.id } }] };
  const ballot = await context.payload.find({ collection: "program-poll-votes", overrideAccess: true, req, depth: 0, limit: 1, where: { voteKey: { equals: voterKey(context, poll.id) } } });
  const options: PollResults["options"] = [];
  // Sequential on transactional requests: a single database connection must not run concurrent queries.
  for (const option of poll.options) {
    const { totalDocs } = await context.payload.count({ collection: "program-poll-votes", overrideAccess: true, req, where: { and: [base, { optionId: { equals: option.id } }] } });
    options.push({ id: option.id, count: totalDocs });
  }
  return { open: poll.open, canVote: context.viewer.kind === "household", selectedOption: ballot.docs[0]?.optionId ?? null, options, total: options.reduce((sum, option) => sum + option.count, 0) };
}
export async function readProgramPoll(context: ActivityContext, pollId: string) {
  return results(context, await pollForDay(context, pollId));
}
export async function voteProgramPoll(context: ActivityContext, pollId: string, input: unknown) {
  if (context.viewer.kind !== "household") throw new HouseholdRequestError(403, "Avstemningen besvares av husstandene.");
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 || !("optionId" in input) || typeof input.optionId !== "string") throw new HouseholdRequestError(400, "Velg et gyldig alternativ.");
  const optionId = input.optionId;
  return guestActivityTransaction(context.payload, async (req) => {
    const poll = await pollForDay(context, pollId, req);
    if (!poll.open) throw new HouseholdRequestError(409, "Avstemningen er avsluttet.");
    if (!poll.options.some((option) => option.id === optionId)) throw new HouseholdRequestError(400, "Velg et gyldig alternativ.");
    const voteKey = voterKey(context, pollId);
    const existing = await context.payload.count({ collection: "program-poll-votes", overrideAccess: true, req, where: { voteKey: { equals: voteKey } } });
    if (!existing.totalDocs) await context.payload.create({ collection: "program-poll-votes", overrideAccess: true, req, data: { dayId: context.dayId, pollId, optionId, voteKey, definition: poll } });
    return results(context, poll, req);
  });
}
