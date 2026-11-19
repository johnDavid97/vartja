import type { PayloadRequest } from "payload";
import { HouseholdRequestError } from "@/features/households/http/requests";
import { publishedGuestPosts } from "@/features/households/auth/access";
import type { GuestActivityContext } from "@/features/guest-activity/server";
import { publishedDay } from "@/features/program/activity/server";
import { programDayLabel } from "@/lib/program";
import type { CommentTarget } from "./validation";

export interface CommentContext extends GuestActivityContext { target: CommentTarget }

export async function publishedCommentSource(context: CommentContext, req?: PayloadRequest) {
  if (context.target.kind === "program-day") {
    const day = await publishedDay({ ...context, dayId: context.target.id }, req);
    return { label: `${programDayLabel(day)} · ${day.date}`, enabled: day.commentsEnabled !== false };
  }
  const { docs } = await context.payload.find({
    collection: "posts", depth: 0, limit: 1, draft: false, overrideAccess: true, req,
    where: { and: [{ id: { equals: Number(context.target.id) } }, publishedGuestPosts] },
    select: { title: true, commentsEnabled: true },
  });
  const post = docs[0];
  // Match the guest article page even for administrators: never expose a draft/private post's thread.
  if (!post) throw new HouseholdRequestError(404, "Fant ikke innlegget.");
  return { label: post.title, enabled: post.commentsEnabled !== false };
}
