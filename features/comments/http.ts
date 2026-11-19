import { guestActivityResponse, limitActivity } from "@/features/guest-activity/server";
import { HouseholdRequestError, readHouseholdRequest } from "@/features/households/http/requests";
import { createComment, moderateComment, readComments } from "./service";
import { validateCommentTarget, type CommentTarget } from "./validation";

/** Shared bounded, same-origin HTTP adapter; the target always comes from the route, never the body. */
export function commentResponse(request: Request, target: CommentTarget) {
  return guestActivityResponse(request, async (viewer) => {
    validateCommentTarget(target);
    const context = { ...viewer, target };
    if (request.method === "GET") {
      const raw = new URL(request.url).searchParams.get("after") ?? "0";
      if (!/^\d{1,10}$/.test(raw) || Number(raw) > 2147483647) throw new HouseholdRequestError(400, "Ugyldig side.");
      return readComments(context, Number(raw));
    }
    if (request.method !== "POST" && request.method !== "PATCH") throw new HouseholdRequestError(405, "Ugyldig metode.");
    const input = await readHouseholdRequest(request, request.method === "POST" ? 12000 : 1024);
    await limitActivity(context);
    return request.method === "POST" ? createComment(context, input) : moderateComment(context, input);
  });
}
