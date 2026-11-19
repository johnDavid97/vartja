import { describe, expect, it } from "vitest";
import { HouseholdError, type HouseholdErrorCode } from "@/features/households/domain/errors";
import {
  deriveHouseholdStatus,
  hasApprovedHouseholdAccess,
  reconcileMembers,
} from "@/features/households/domain/member-policy";
import type { HouseholdMember } from "@/features/households/domain/models";
import {
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
  validateHouseholdInput,
} from "@/features/households/domain/validation";

const validInput = {
  contactName: " Kari Nordmann ",
  email: " KARI@Example.COM ",
  members: [{ name: " Kari " }, { id: "member-2", name: " Ola " }],
};

function expectHouseholdError(action: () => unknown, code: HouseholdErrorCode): void {
  try {
    action();
    throw new Error("Expected a HouseholdError");
  } catch (error) {
    expect(error).toBeInstanceOf(HouseholdError);
    expect((error as HouseholdError).code).toBe(code);
  }
}

describe("household input validation", () => {
  it("normalizes valid names and email without adding the contact as a member", () => {
    expect(validateHouseholdInput(validInput)).toEqual({
      contactName: "Kari Nordmann",
      email: "kari@example.com",
      members: [{ name: "Kari" }, { id: "member-2", name: "Ola" }],
    });
  });

  it.each([null, [], "household", 42])("rejects malformed household input %#", (input) => {
    expectHouseholdError(() => validateHouseholdInput(input), "INVALID_INPUT");
  });

  it("rejects missing, empty, and oversized member lists", () => {
    expectHouseholdError(
      () => validateHouseholdInput({ contactName: "Kari", email: "k@example.com" }),
      "INVALID_INPUT",
    );
    expectHouseholdError(
      () => validateHouseholdInput({ ...validInput, members: [] }),
      "INVALID_MEMBERS",
    );
    expectHouseholdError(
      () =>
        validateHouseholdInput({
          ...validInput,
          members: Array.from({ length: MAX_MEMBERS + 1 }, (_, index) => ({ name: `Guest ${index}` })),
        }),
      "TOO_MANY_MEMBERS",
    );
  });

  it("accepts the member limit and rejects empty or overlong names", () => {
    const members = Array.from({ length: MAX_MEMBERS }, (_, index) => ({ name: `Guest ${index}` }));
    expect(validateHouseholdInput({ ...validInput, members }).members).toHaveLength(MAX_MEMBERS);
    expectHouseholdError(
      () => validateHouseholdInput({ ...validInput, contactName: "   " }),
      "INVALID_NAME",
    );
    expectHouseholdError(
      () =>
        validateHouseholdInput({
          ...validInput,
          members: [{ name: "x".repeat(MAX_NAME_LENGTH + 1) }],
        }),
      "INVALID_NAME",
    );
  });

  it.each(["missing-at.example.com", "two@@example.com", "space @example.com", "x@localhost"])(
    "rejects malformed email %s",
    (email) => {
      expectHouseholdError(() => validateHouseholdInput({ ...validInput, email }), "INVALID_EMAIL");
    },
  );

  it("rejects unknown approval, identity, and security fields", () => {
    expectHouseholdError(
      () => validateHouseholdInput({ ...validInput, status: "approved" }),
      "UNKNOWN_FIELD",
    );
    expectHouseholdError(
      () =>
        validateHouseholdInput({
          ...validInput,
          members: [{ name: "Kari", status: "approved" }],
        }),
      "UNKNOWN_FIELD",
    );
    expectHouseholdError(
      () => validateHouseholdInput({ ...validInput, accessCode: "secret" }),
      "UNKNOWN_FIELD",
    );
  });

  it("rejects malformed and duplicate member IDs", () => {
    expectHouseholdError(
      () => validateHouseholdInput({ ...validInput, members: [{ id: " bad id ", name: "Kari" }] }),
      "INVALID_MEMBER_ID",
    );
    expectHouseholdError(
      () =>
        validateHouseholdInput({
          ...validInput,
          members: [
            { id: "same", name: "Kari" },
            { id: "same", name: "Ola" },
          ],
        }),
      "DUPLICATE_MEMBER_ID",
    );
  });

  it("rejects sparse member lists with a typed error", () => {
    expectHouseholdError(
      () => validateHouseholdInput({ ...validInput, members: new Array(1) }),
      "INVALID_INPUT",
    );
  });

  it("uses safe errors that do not include submitted values", () => {
    expect.assertions(2);
    const sensitiveValue = "private-value@example";
    try {
      validateHouseholdInput({ ...validInput, email: sensitiveValue });
    } catch (error) {
      expect(error).toBeInstanceOf(HouseholdError);
      expect((error as Error).message).not.toContain(sensitiveValue);
    }
  });
});

describe("member reconciliation", () => {
  const existing: readonly HouseholdMember[] = [
    { id: "approved-member", name: "Kari", status: "approved" },
    { id: "pending-member", name: "Ola", status: "pending" },
  ];

  it("preserves approval on a name correction and marks additions pending", () => {
    expect(
      reconcileMembers(existing, [
        { id: "approved-member", name: "Kari Nordmann" },
        { id: "pending-member", name: "Ola" },
        { name: "Nora" },
      ]),
    ).toEqual({
      updates: [{ id: "approved-member", name: "Kari Nordmann", status: "approved" }],
      additions: [{ name: "Nora", status: "pending" }],
      removals: [],
    });
  });

  it("preserves rejection on a name correction", () => {
    const rejected: readonly HouseholdMember[] = [
      { id: "rejected-member", name: "Nora", status: "revoked" },
    ];
    expect(reconcileMembers(rejected, [{ id: "rejected-member", name: "Nora Nordmann" }])).toEqual({
      updates: [{ id: "rejected-member", name: "Nora Nordmann", status: "revoked" }],
      additions: [],
      removals: [],
    });
  });

  it("removes omitted existing members", () => {
    expect(reconcileMembers(existing, [{ id: "approved-member", name: "Kari" }])).toEqual({
      updates: [],
      additions: [],
      removals: ["pending-member"],
    });
  });

  it("rejects a member ID belonging to another household and duplicate IDs", () => {
    expectHouseholdError(
      () => reconcileMembers(existing, [{ id: "other-household-member", name: "Unknown" }]),
      "UNKNOWN_MEMBER_ID",
    );
    expectHouseholdError(
      () =>
        reconcileMembers(existing, [
          { id: "approved-member", name: "Kari" },
          { id: "approved-member", name: "Again" },
        ]),
      "DUPLICATE_MEMBER_ID",
    );
  });

  it("does not mutate existing members or requested edits", () => {
    const mutableExisting: HouseholdMember[] = existing.map((member) => ({ ...member }));
    const edits = [{ id: "approved-member", name: "Changed" }, { name: "New" }];
    const beforeExisting = structuredClone(mutableExisting);
    const beforeEdits = structuredClone(edits);

    reconcileMembers(mutableExisting, edits);

    expect(mutableExisting).toEqual(beforeExisting);
    expect(edits).toEqual(beforeEdits);
  });

  it("does not allocate IDs in the pure domain plan", () => {
    const plan = reconcileMembers(existing, [{ name: "New member" }]);
    expect(plan.additions).toEqual([{ name: "New member", status: "pending" }]);
    expect(plan.additions[0]).not.toHaveProperty("id");
  });
});

describe("household status derivation", () => {
  it.each([
    [["approved"], "approved"],
    [["revoked", "approved", "pending"], "approved"],
    [["revoked", "pending"], "pending"],
    [["pending", "pending"], "pending"],
    [["revoked"], "revoked"],
    [["revoked", "revoked"], "revoked"],
  ] as const)("derives %s as %s", (statuses, expected) => {
    expect(deriveHouseholdStatus(statuses.map((status) => ({ status })))).toBe(expected);
  });

  it("rejects an empty member list", () => {
    expectHouseholdError(() => deriveHouseholdStatus([]), "INVALID_MEMBERS");
  });
});

describe("household access", () => {
  it("allows approved households even when their reconciliation has pending additions", () => {
    const plan = reconcileMembers([], [{ name: "New member" }]);
    expect(plan.additions[0].status).toBe("pending");
    expect(hasApprovedHouseholdAccess("approved")).toBe(true);
  });

  it("denies pending and revoked households", () => {
    expect(hasApprovedHouseholdAccess("pending")).toBe(false);
    expect(hasApprovedHouseholdAccess("revoked")).toBe(false);
  });
});
