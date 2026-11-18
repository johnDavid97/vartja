import { HouseholdError } from "./errors";

export const MAX_HOUSEHOLD_NAME_LENGTH = 120;

const controlCharacterPattern = /\p{Cc}/u;
const whitespacePattern = /\s+/gu;

/** Normalize a household's public login/display name at every write boundary. */
export function normalizeHouseholdName(value: unknown): string {
  if (typeof value !== "string" || controlCharacterPattern.test(value)) {
    throw new HouseholdError("INVALID_NAME");
  }
  const normalized = value.normalize("NFKC").replace(whitespacePattern, " ").trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_HOUSEHOLD_NAME_LENGTH ||
    controlCharacterPattern.test(normalized)
  ) {
    throw new HouseholdError("INVALID_NAME");
  }
  return normalized;
}

function normalizedSuggestionPart(value: string): string | null {
  try {
    return normalizeHouseholdName(value);
  } catch {
    return null;
  }
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

function joinedNames(names: string[]): string {
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} og ${names.at(-1)}`;
}

/** Suggestions are conveniences only; they make no claim that members share a surname. */
export function suggestHouseholdNames(contactName: string, additionalMemberNames: string[]): string[] {
  const contact = normalizedSuggestionPart(contactName);
  if (!contact) return [];
  const members = [contact, ...additionalMemberNames.map(normalizedSuggestionPart).filter((name): name is string => Boolean(name))];
  const firstNames = members.map(firstName);
  const suggestions: string[] = [];

  if (members.length <= 2) {
    suggestions.push(joinedNames(firstNames));
  } else {
    const contactParts = contact.split(" ");
    const surname = contactParts.length > 1 ? contactParts.at(-1) : null;
    if (surname) suggestions.push(`Familien ${surname}`);
    suggestions.push(joinedNames(firstNames));
  }

  return [...new Set(suggestions)].filter((suggestion) => suggestion.length <= MAX_HOUSEHOLD_NAME_LENGTH);
}
