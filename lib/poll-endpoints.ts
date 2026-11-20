import type { Endpoint, PayloadRequest, Where } from "payload";
import { getPolls, type PollDefinition, type PollResults } from "./polls";
import { pollVoter, pollVoteKey } from "./poll-voter";
import { canReadGuestContent } from "../features/households/auth/access";
import { HouseholdRequestError, readHouseholdRequest } from "../features/households/http/requests";
import { ActivityRateLimitExceededError } from "../features/guest-activity/rate-limit";
import { limitNewLegacyPostPollBallot } from "../features/polls/rate-limit";

function reply(data: unknown, status = 200, cookie?: string | null, extraHeaders?: Record<string, string>) {
  const headers = new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie", ...extraHeaders });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json(data, { status, headers });
}

async function results(req: PayloadRequest, post: number, poll: PollDefinition, voteKey: string): Promise<PollResults> {
  const base: Where = { and: [{ post: { equals: post } }, { pollId: { equals: poll.id } }] };
  const [ballot, counts] = await Promise.all([
    req.payload.find({ collection: "poll-votes", where: { voteKey: { equals: voteKey } }, limit: 1, depth: 0, overrideAccess: true }),
    Promise.all(poll.options.map(async (option) => {
      const { totalDocs } = await req.payload.count({
        collection: "poll-votes", overrideAccess: true,
        where: { and: [base, { optionId: { equals: option.id } }] },
      });
      return { id: option.id, count: totalDocs };
    })),
  ]);
  return { open: poll.open, selectedOption: ballot.docs[0]?.optionId || null, total: counts.reduce((sum, option) => sum + option.count, 0), options: counts };
}

function handler(voting: boolean): Endpoint["handler"] {
  return async (req) => {
    const id = String(req.routeParams?.postId || "");
    const postId = Number(id);
    const pollId = String(req.routeParams?.pollId || "");
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(postId) || postId < 1 || postId > 2147483647 || !pollId || pollId.length > 128) {
      return reply({ error: "Fant ikke avstemningen." }, 404);
    }
    if (voting) {
      // Cookie-based anonymous voting must not accept cross-site form submissions.
      const origin = req.headers.get("origin");
      if (!req.url || origin !== new URL(req.url).origin) return reply({ error: "Ugyldig forespørsel." }, 403);
      if (!req.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Forventet JSON." }, 415);
      if (Number(req.headers.get("content-length")) > 2048) return reply({ error: "Forespørselen er for stor." }, 413);
    }
    if (!await canReadGuestContent({ req })) return reply({ error: "Logg inn med en godkjent husstand." }, 403);
    const { docs } = await req.payload.find({
      collection: "posts", where: { id: { equals: postId } },
      draft: false, overrideAccess: false, req, limit: 1, depth: 0,
    });
    const post = docs[0];
    // Never allow voting on drafts/private posts, even for an authenticated editor.
    if (!post || post._status !== "published" || post.visibility === "private") return reply({ error: "Fant ikke avstemningen." }, 404);
    const poll = getPolls(post.body).find((item) => item.id === pollId);
    if (!poll) return reply({ error: "Fant ikke avstemningen." }, 404);

    const secret = req.payload.config.secret;
    const voter = pollVoter(req.headers.get("cookie"), secret);
    const voteKey = pollVoteKey(postId, pollId, voter.id, secret);
    if (voting) {
      if (!poll.open) return reply({ error: "Avstemningen er avsluttet." }, 409, voter.cookie);
      let optionId: unknown;
      try {
        const input = await readHouseholdRequest(req, 2048);
        optionId = input && typeof input === "object" && "optionId" in input ? input.optionId : undefined;
      } catch (error) {
        return reply({ error: "Ugyldig forespørsel." }, error instanceof HouseholdRequestError ? error.status : 400, voter.cookie);
      }
      if (typeof optionId !== "string" || !poll.options.some((option) => option.id === optionId)) {
        return reply({ error: "Velg et gyldig alternativ." }, 400, voter.cookie);
      }
      const existing = await req.payload.count({ collection: "poll-votes", where: { voteKey: { equals: voteKey } }, overrideAccess: true });
      if (!existing.totalDocs) {
        try {
          await limitNewLegacyPostPollBallot(req);
        } catch (error) {
          if (error instanceof ActivityRateLimitExceededError) {
            return reply({ error: "For mange forespørsler. Vent litt og prøv igjen." }, 429, voter.cookie, { "Retry-After": "60" });
          }
          return reply({ error: "Kunne ikke fullføre forespørselen. Prøv igjen." }, 503, voter.cookie);
        }
        try {
          await req.payload.create({ collection: "poll-votes", overrideAccess: true, data: { post: postId, pollId, optionId, voteKey, definition: poll } });
        } catch (error) {
          // Concurrent new attempts may consume several quota slots; the unique key still stores one ballot.
          const duplicate = await req.payload.count({ collection: "poll-votes", where: { voteKey: { equals: voteKey } }, overrideAccess: true });
          if (!duplicate.totalDocs) throw error;
        }
      }
    }
    return reply(await results(req, postId, poll, voteKey), 200, voter.cookie);
  };
}

export const pollEndpoints: Endpoint[] = [
  { path: "/:postId/polls/:pollId", method: "get", handler: handler(false) },
  { path: "/:postId/polls/:pollId", method: "post", handler: handler(true) },
];
