import type { Payload, PayloadRequest } from "payload";
import { householdSessionForRequest } from "@/features/households/auth/access";
import { activityRateLimitBucket, consumeActivityAttempt } from "@/features/guest-activity/rate-limit";

export const LEGACY_POST_POLL_QUOTA_PURPOSE = "legacy-post-poll-write-quota";

export function legacyPostPollQuotaBucket(payload: Pick<Payload, "config">, householdId: number): string {
  return activityRateLimitBucket(payload, LEGACY_POST_POLL_QUOTA_PURPOSE, { kind: "household", id: householdId });
}

export async function consumeLegacyPostPollAttempt(payload: Pick<Payload, "config" | "db">, householdId: number): Promise<void> {
  await consumeActivityAttempt(payload, { kind: "household", id: householdId }, LEGACY_POST_POLL_QUOTA_PURPOSE);
}

/** Administrators retain trusted native behavior; guest identity comes only from the resolved server session. */
export async function limitNewLegacyPostPollBallot(req: PayloadRequest): Promise<"administrator" | "household"> {
  if (req.user?.collection === "users") return "administrator";
  const session = await householdSessionForRequest(req);
  if (session?.status !== "approved") throw new Error("Approved household session unavailable");
  await consumeLegacyPostPollAttempt(req.payload, session.householdId);
  return "household";
}
