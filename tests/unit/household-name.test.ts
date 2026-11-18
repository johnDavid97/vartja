import { describe, expect, it } from "vitest";

import { validateInitialHousehold } from "../../features/households/domain/initial-household";
import {
  MAX_HOUSEHOLD_NAME_LENGTH,
  normalizeHouseholdName,
  suggestHouseholdNames,
} from "../../features/households/domain/household-name";

const oldRequest = {
  requestKey: "123e4567-e89b-42d3-a456-426614174000",
  contactName: " Aud Nordmann ",
  email: "AUD@example.no",
  additionalMembers: [{ name: "Erik Nordmann" }],
};

describe("household display names", () => {
  it("normalizes Unicode and collapses whitespace", () => {
    expect(normalizeHouseholdName("  Familien\u00a0Ａud  ")).toBe("Familien Aud");
  });

  it.each(["", "   ", "Aud\nErik", `A${String.fromCharCode(127)}B`, "x".repeat(MAX_HOUSEHOLD_NAME_LENGTH + 1)])(
    "rejects malformed name %j",
    (name) => expect(() => normalizeHouseholdName(name)).toThrow(),
  );

  it("suggests first names for two people", () => {
    expect(suggestHouseholdNames("Aud Nordmann", ["Erik Hansen"])).toEqual(["Aud og Erik"]);
  });

  it("offers an editable family-style and member-name suggestion for larger households", () => {
    expect(suggestHouseholdNames("Aud Nordmann", ["Erik Hansen", "Liv Olsen"])).toEqual([
      "Familien Nordmann",
      "Aud, Erik og Liv",
    ]);
  });

  it("keeps the original normalized DTO shape when an old request omits displayName", () => {
    expect(validateInitialHousehold(oldRequest)).toEqual({
      requestKey: oldRequest.requestKey,
      contactName: "Aud Nordmann",
      email: "aud@example.no",
      memberNames: ["Aud Nordmann", "Erik Nordmann"],
    });
    expect(validateInitialHousehold(oldRequest)).not.toHaveProperty("displayName");
  });

  it("normalizes an explicit displayName into the immutable request DTO", () => {
    expect(validateInitialHousehold({ ...oldRequest, displayName: "  Aud   og Erik " })).toMatchObject({
      displayName: "Aud og Erik",
    });
  });
});
