import { HouseholdRequestError } from "@/features/households/http/requests";

export interface CommentInput { requestKey: string; body: string; parentId: number | null }
export interface ProgramCommentView {
  id: number;
  parentId: number | null;
  authorName: string;
  administrator: boolean;
  body: string;
  hidden: boolean;
  createdAt: string;
}
export interface CommentPage { comments: ProgramCommentView[]; nextCursor: number | null; enabled: boolean }

export function validDayId(value: string): boolean { return /^[a-zA-Z0-9_-]{1,64}$/.test(value); }
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
