import { ValidationError, type GlobalBeforeChangeHook } from "payload";
import { parsePoll, samePollChoices } from "@/lib/polls";
import { programError, type ProgramData } from "@/lib/program";
import { lockGuestActivity } from "@/features/guest-activity/transaction";

export const validateProgramPolls: GlobalBeforeChangeHook = async ({ data, originalDoc, req }) => {
  await lockGuestActivity(req);
  const itinerary = data.itinerary ?? originalDoc?.itinerary;
  const invalid = programError(itinerary, (data._status ?? originalDoc?._status) === "published");
  const fail = (message: string): never => { throw new ValidationError({ errors: [{ path: "itinerary", message }] }); };
  if (invalid) fail(invalid);
  for (const day of (itinerary as ProgramData).days) {
    for (const poll of day.polls ?? []) {
      const { docs } = await req.payload.find({
        collection: "program-poll-votes", overrideAccess: true, req, depth: 0, limit: 1,
        where: { pollId: { equals: poll.id } },
      });
      const ballot = docs[0];
      if (!ballot) continue;
      const original = parsePoll(ballot.definition);
      const updated = parsePoll(poll);
      if (!original || !updated || ballot.dayId !== day.id || !samePollChoices(original, updated)) {
        fail("Avstemningen har stemmer. Du kan avslutte eller fjerne den, men lag en ny avstemning for å endre spørsmål, svar eller dag.");
      }
    }
  }
  return data;
};
