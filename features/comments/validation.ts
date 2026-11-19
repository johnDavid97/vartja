import type { Where } from "payload";
import { HouseholdRequestError } from "@/features/households/http/requests";

export interface CommentInput { requestKey: string; body: string; parentId: number | null }
export type CommentTarget = { kind: "program-day" | "post"; id: string };
export interface CommentView {
  id: number;
  parentId: number | null;
  authorName: string;
  administrator: boolean;
  body: string;
  hidden: boolean;
  createdAt: string;
}
export interface CommentPage { comments: CommentView[]; nextCursor: number | null; enabled: boolean }

export function validateCommentTarget(target: CommentTarget): void {
  const valid = target.kind === "program-day"
    ? /^[a-zA-Z0-9_-]{1,64}$/.test(target.id)
    : target.kind === "post" && /^\d{1,10}$/.test(target.id) && Number(target.id) > 0 && Number(target.id) <= 2147483647;
  if (!valid) throw new HouseholdRequestError(404, "Fant ikke innholdet.");
}
export function commentScope(target: CommentTarget): Where {
  return { and: [
    { source: { equals: target.kind } },
    target.kind === "post" ? { postId: { equals: Number(target.id) } } : { dayId: { equals: target.id } },
  ] };
}

/** Preserve Program fingerprint material so uncertain requests survive this additive release. */
export function commentFingerprintScope(target: CommentTarget): string | ["post", number] {
  return target.kind === "program-day" ? target.id : ["post", Number(target.id)];
}

export function parseModerationInput(value: unknown): { id: number; status: "published" | "hidden" } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HouseholdRequestError(400, "Ugyldig forespørsel.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || typeof input.id !== "number" || !Number.isSafeInteger(input.id) || input.id < 1 || input.id > 2147483647 || (input.status !== "published" && input.status !== "hidden")) {
    throw new HouseholdRequestError(400, "Ugyldig forespørsel.");
  }
  return { id: input.id, status: input.status };
}

export function parseCommentInput(value: unknown): CommentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HouseholdRequestError(400, "Kontroller kommentaren.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["requestKey", "body", "parentId"].includes(key)) ||
    typeof input.requestKey !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestKey) ||
    typeof input.body !== "string" || input.body.length > 2000 || !input.body.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.body) ||
    (input.parentId !== null && (!Number.isSafeInteger(input.parentId) || Number(input.parentId) < 1 || Number(input.parentId) > 2147483647))) {
    throw new HouseholdRequestError(400, "Skriv en kommentar på 1–2000 tegn.");
  }
  return { requestKey: input.requestKey, body: input.body.trim(), parentId: input.parentId as number | null };
}
