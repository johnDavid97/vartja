import { AuthError } from "./errors";
import { normalizeHouseholdName as normalizeDisplayName } from "../domain/household-name";

const codeAlphabet = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{24}$/;
const inputKeys = ["accessCode", "householdName", "remember"] as const;

export type ValidatedLogin = {
  householdName: string;
  comparableName: string;
  accessCode: string;
  remember: boolean;
};

/** Display-preserving normalization used before locale-aware comparison. */
export function normalizeHouseholdName(value: unknown): string {
  // Pasted login names may contain line breaks; stored display names still reject control characters.
  try { return normalizeDisplayName(typeof value === "string" ? value.replace(/\s+/gu, " ") : value); }
  catch { throw new AuthError("INVALID_INPUT"); }
}

export function comparableHouseholdName(value: unknown): string {
  return normalizeHouseholdName(value).replace(/\s/gu, "").toLocaleLowerCase("nb-NO");
}

/** Accepts the originally issued 24-character code with optional whitespace/hyphens and casing. */
export function canonicalizeAccessCode(value: unknown): string {
  if (typeof value !== "string") throw new AuthError("INVALID_INPUT");
  const ungrouped = value.normalize("NFKC").replace(/[\s-]/gu, "").toUpperCase();
  if (!codeAlphabet.test(ungrouped)) throw new AuthError("INVALID_INPUT");
  return ungrouped.match(/.{4}/g)!.join("-");
}

export function validateLoginInput(input: unknown): ValidatedLogin {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AuthError("INVALID_INPUT");
  }
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== inputKeys.length || inputKeys.some((key, index) => key !== keys[index])) {
    throw new AuthError("INVALID_INPUT");
  }
  if (typeof record.remember !== "boolean") throw new AuthError("INVALID_INPUT");
  const householdName = normalizeHouseholdName(record.householdName);
  return {
    householdName,
    comparableName: comparableHouseholdName(householdName),
    accessCode: canonicalizeAccessCode(record.accessCode),
    remember: record.remember,
  };
}

/** Stable, non-sensitive limiter material even when the request itself is malformed. */
export function limiterNameMaterial(input: unknown): string {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return "invalid-input";
  const candidate = (input as Record<string, unknown>).householdName;
  if (typeof candidate !== "string") return "invalid-name";
  try {
    return comparableHouseholdName(candidate);
  } catch {
    return "invalid-name";
  }
}
