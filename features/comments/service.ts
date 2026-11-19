import type { PayloadRequest } from "payload";
import type { ProgramComment } from "@/payload-types";
import { HouseholdRequestError } from "@/features/households/http/requests";
import { activityDigest } from "@/features/guest-activity/server";
import { guestActivityTransaction } from "@/features/guest-activity/transaction";
import { publishedCommentSource, type CommentContext } from "./source";
import { commentScope, commentFingerprintScope, parseCommentInput, parseModerationInput, type CommentPage, type CommentView } from "./validation";

function relationshipId(value: number | { id: number } | null | undefined): number | null { return typeof value === "number" ? value : value?.id ?? null; }
function commentView(comment: ProgramComment): CommentView {
  const householdName = typeof comment.household === "object" ? comment.household?.displayName : null;
  const administratorName = typeof comment.administrator === "object" ? comment.administrator?.name : null;
  const hidden = comment.status === "hidden";
  return {
    id: comment.id, parentId: relationshipId(comment.parent), createdAt: comment.createdAt,
    hidden, body: hidden ? "" : comment.body,
    authorName: hidden ? "" : householdName || administratorName || comment.authorName,
    administrator: !hidden && Boolean(comment.administrator),
  };
}
export async function readComments(context: CommentContext, cursor: number): Promise<CommentPage> {
  const source = await publishedCommentSource(context);
  const { docs } = await context.payload.find({ collection: "program-comments", overrideAccess: true, depth: 1, sort: "id", limit: 51, where: { and: [commentScope(context.target), { id: { greater_than: cursor } }] } });
  const page = docs.slice(0, 50);
  return { comments: page.map(commentView), nextCursor: docs.length > 50 ? page.at(-1)!.id : null, enabled: source.enabled };
}
async function hydratedComment(context: CommentContext, id: number, req: PayloadRequest) {
  const comment = await context.payload.findByID({ collection: "program-comments", id, overrideAccess: true, req, depth: 1 });
  return commentView(comment);
}
export async function createComment(context: CommentContext, input: unknown) {
  const parsed = parseCommentInput(input);
  const requestDigest = activityDigest(context.payload, "comment-request", [context.viewer.kind, context.viewer.id, parsed.requestKey]);
  const requestFingerprint = activityDigest(context.payload, "comment-content", [commentFingerprintScope(context.target), parsed.body, parsed.parentId]);
  return guestActivityTransaction(context.payload, async (req) => {
    const source = await publishedCommentSource(context, req);
    const existing = await context.payload.find({ collection: "program-comments", overrideAccess: true, req, limit: 1, depth: 0, where: { requestDigest: { equals: requestDigest } } });
    if (existing.docs[0]) {
      if (existing.docs[0].requestFingerprint !== requestFingerprint) throw new HouseholdRequestError(409, "Forespørselen er allerede brukt med en annen kommentar.");
      return hydratedComment(context, existing.docs[0].id, req);
    }
    if (!source.enabled) throw new HouseholdRequestError(409, "Kommentarer er stengt her.");
    if (parsed.parentId !== null) {
      const parent = await context.payload.find({ collection: "program-comments", overrideAccess: true, req, limit: 1, depth: 0, where: { and: [{ id: { equals: parsed.parentId } }, commentScope(context.target), { status: { equals: "published" } }] } });
      if (!parent.docs[0] || parent.docs[0].parent) throw new HouseholdRequestError(400, "Velg en synlig kommentar på samme innlegg eller programdag å svare på.");
    }
    const comment = await context.payload.create({ collection: "program-comments", overrideAccess: true, req, data: {
      source: context.target.kind,
      dayId: context.target.kind === "program-day" ? context.target.id : null,
      postId: context.target.kind === "post" ? Number(context.target.id) : null,
      dayLabel: source.label, authorName: context.viewer.name,
      household: context.viewer.kind === "household" ? context.viewer.id : null,
      administrator: context.viewer.kind === "administrator" ? context.viewer.id : null,
      body: parsed.body, parent: parsed.parentId, status: "published", requestDigest, requestFingerprint,
    } });
    return hydratedComment(context, comment.id, req);
  });
}
export async function moderateComment(context: CommentContext, input: unknown) {
  if (context.viewer.kind !== "administrator") throw new HouseholdRequestError(403, "Kun administratorer kan moderere kommentarer.");
  const { id, status } = parseModerationInput(input);
  return guestActivityTransaction(context.payload, async (req) => {
    await publishedCommentSource(context, req);
    const found = await context.payload.find({ collection: "program-comments", req, overrideAccess: true, depth: 0, limit: 1, where: { and: [{ id: { equals: id } }, commentScope(context.target)] } });
    if (!found.docs[0]) throw new HouseholdRequestError(404, "Fant ikke kommentaren.");
    await context.payload.update({ collection: "program-comments", id, req, overrideAccess: true, data: { status } });
    return hydratedComment(context, id, req);
  });
}
