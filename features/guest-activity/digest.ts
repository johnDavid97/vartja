import { createHmac } from "node:crypto";
import type { Payload } from "payload";

/** Stable namespace shared with the existing Program/comment activity digests. */
export function activityDigest(payload: Pick<Payload, "config">, purpose: string, value: unknown): string {
  return createHmac("sha256", payload.config.secret)
    .update(JSON.stringify(["program-activity-v1", purpose, value]))
    .digest("hex");
}
