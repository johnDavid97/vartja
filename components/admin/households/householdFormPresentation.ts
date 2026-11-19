import type { MemberStatus } from "@/features/households/domain/models";

type FormFieldState = { value?: unknown };
type FormFields = Record<string, FormFieldState>;

export type LiveMember = {
  index: number;
  name: string;
  status: MemberStatus;
};

function isMemberStatus(value: unknown): value is MemberStatus {
  return value === "pending" || value === "approved" || value === "revoked";
}

/** A primitive selector result avoids rerenders when unrelated form fields change. */
export function memberFieldsSignature(fields: FormFields): string {
  const members = new Map<number, Partial<LiveMember>>();
  for (const [path, fieldState] of Object.entries(fields)) {
    const match = /^members\.(\d+)\.(name|status)$/.exec(path);
    if (!match) continue;
    const index = Number(match[1]);
    const member = members.get(index) ?? { index };
    if (match[2] === "name" && typeof fieldState.value === "string") member.name = fieldState.value;
    if (match[2] === "status" && isMemberStatus(fieldState.value)) member.status = fieldState.value;
    members.set(index, member);
  }
  return JSON.stringify([...members.values()]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((member) => ({ index: member.index ?? 0, name: member.name ?? "", status: member.status ?? "pending" })));
}

export function membersFromSignature(signature: string): LiveMember[] {
  try {
    return JSON.parse(signature) as LiveMember[];
  } catch {
    return [];
  }
}
