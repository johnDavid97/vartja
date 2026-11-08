import { ValidationError, type CollectionBeforeChangeHook } from "payload";
import { getPollFields, getPolls, parsePoll, samePollChoices } from "./polls";

export const validatePostPolls: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const body = data.body === undefined ? originalDoc?.body : data.body;
  const polls = getPolls(body);
  const fail = (message: string): never => { throw new ValidationError({ errors: [{ path: "body", message }] }); };
  if ((data._status || originalDoc?._status) === "published") {
    if (polls.length !== getPollFields(body).length) fail("Hver avstemning trenger et spørsmål og 2–10 forskjellige svaralternativer.");
    if (new Set(polls.map((poll) => poll.id)).size !== polls.length) fail("Avstemningene må ha forskjellige ID-er. Fjern kopien og legg til en ny avstemning.");
  }
  if (originalDoc?.id) {
    for (const fields of getPollFields(body)) {
      const id = (fields as { id?: string }).id;
      if (!id) continue;
      const { docs } = await req.payload.find({
        collection: "poll-votes", overrideAccess: true, req, limit: 1, depth: 0,
        where: { and: [{ post: { equals: originalDoc.id } }, { pollId: { equals: id } }] },
      });
      const original = parsePoll(docs[0]?.definition);
      const updated = parsePoll(fields);
      if (original && (!updated || !samePollChoices(original, updated))) {
        fail("Denne avstemningen har stemmer. Du kan avslutte eller flytte den, men opprett en ny avstemning for å endre spørsmålet eller svarene.");
      }
    }
  }
  return data;
};
