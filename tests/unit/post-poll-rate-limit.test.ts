import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Payload, PayloadRequest } from "payload";
import {
  ACTIVITY_ATTEMPTS_PER_MINUTE,
  ActivityRateLimitExceededError,
  activityRateLimitBucket,
  consumeActivityAttempt,
} from "@/features/guest-activity/rate-limit";
import {
  LEGACY_POST_POLL_QUOTA_PURPOSE,
  consumeLegacyPostPollAttempt,
  legacyPostPollQuotaBucket,
  limitNewLegacyPostPollBallot,
} from "@/features/polls/rate-limit";

function payloadWith(execute: ReturnType<typeof vi.fn>, secret = "unit-test-secret") {
  return { config: { secret }, db: { drizzle: { execute } } } as unknown as Payload;
}

describe("legacy post-poll attempt quota", () => {
  it("uses the dedicated namespace and server household actor at 20 attempts per minute", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
    const payload = payloadWith(execute);
    const expected = createHmac("sha256", payload.config.secret)
      .update(JSON.stringify(["program-activity-v1", "legacy-post-poll-write-quota", ["household", 42]]))
      .digest("hex");

    expect(LEGACY_POST_POLL_QUOTA_PURPOSE).toBe("legacy-post-poll-write-quota");
    expect(ACTIVITY_ATTEMPTS_PER_MINUTE).toBe(20);
    expect(legacyPostPollQuotaBucket(payload, 42)).toBe(expected);
    await consumeLegacyPostPollAttempt(payload, 42);

    expect(execute).toHaveBeenCalledOnce();
    const statement = JSON.stringify(execute.mock.calls[0][0]);
    expect(statement).toContain(expected);
    expect(statement).toContain("program_activity_limits");
  });

  it("preserves the existing default Program/comment digest and attempt behavior", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
    const payload = payloadWith(execute);
    const actor = { kind: "household" as const, id: 12 };
    const previousDigest = createHmac("sha256", payload.config.secret)
      .update(JSON.stringify(["program-activity-v1", "write-quota", ["household", 12]]))
      .digest("hex");
    expect(activityRateLimitBucket(payload, "write-quota", actor)).toBe(previousDigest);
    await consumeActivityAttempt(payload, actor);
    expect(JSON.stringify(execute.mock.calls[0][0])).toContain(previousDigest);
  });

  it("denies when the atomic upsert returns no row", async () => {
    const payload = payloadWith(vi.fn().mockResolvedValue({ rows: [] }));
    await expect(consumeLegacyPostPollAttempt(payload, 7)).rejects.toBeInstanceOf(ActivityRateLimitExceededError);
  });

  it("propagates database failures for fail-closed HTTP handling", async () => {
    const failure = new Error("database unavailable");
    const payload = payloadWith(vi.fn().mockRejectedValue(failure));
    await expect(consumeLegacyPostPollAttempt(payload, 7)).rejects.toBe(failure);
  });

  it("keeps trusted native administrators exempt", async () => {
    const execute = vi.fn();
    const req = { user: { collection: "users", id: 9 }, payload: payloadWith(execute) } as unknown as PayloadRequest;
    await expect(limitNewLegacyPostPollBallot(req)).resolves.toBe("administrator");
    expect(execute).not.toHaveBeenCalled();
  });
});
