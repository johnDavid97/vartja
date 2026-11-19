import { describe, expect, it } from "vitest";
import { createHouseholdApplication } from "../../features/households/composition-root";
import type { HouseholdDetailsUpdate, HouseholdRecord, HouseholdRepository, MemberIdGenerator } from "../../features/households/application/ports";

class FakeHouseholds implements HouseholdRepository {
  writes = 0;
  concurrentChange = false;
  constructor(public record: HouseholdRecord | null) {}

  async findById(id: string) {
    return this.record?.id === id ? structuredClone(this.record) : null;
  }

  async updateDetails(id: string, revision: number, details: HouseholdDetailsUpdate) {
    if (this.concurrentChange || !this.record || this.record.id !== id || this.record.revision !== revision) return false;
    this.record = { ...this.record, ...structuredClone(details), revision: revision + 1 };
    this.writes += 1;
    return true;
  }
}

class FakeMemberIds implements MemberIdGenerator {
  count = 0;
  next() { return `new-${++this.count}`; }
}

function setup() {
  const record: HouseholdRecord = {
    id: "household-1", contactName: "Alex", email: "alex@example.com", status: "approved", revision: 3,
    members: [
      { id: "member-1", name: "Alex", status: "approved" },
      { id: "member-2", name: "Sam", status: "pending" },
    ],
  };
  const households = new FakeHouseholds(record);
  const memberIds = new FakeMemberIds();
  const app = createHouseholdApplication({ households, memberIds });
  const input = {
    contactName: " Alex Example ", email: " NEW@example.com ",
    members: [{ id: "member-1", name: "Alex Example" }, { name: "Robin" }],
  };
  return { app, households, memberIds, record, input, principal: { householdId: record.id } };
}

describe("UpdateHouseholdDetails", () => {
  it("uses injected dependencies, normalizes details and preserves approval while adding pending members", async () => {
    const { app, households, input, principal, record } = setup();
    const result = await app.updateDetails.execute(principal, 3, input);
    expect(result).toMatchObject({ contactName: "Alex Example", email: "new@example.com", status: "approved", revision: 4 });
    expect(result.members).toEqual([
      { id: "member-1", name: "Alex Example", status: "approved" },
      { id: "new-1", name: "Robin", status: "pending" },
    ]);
    expect(households.writes).toBe(1);
    expect(record.members[0].name).toBe("Alex");
    expect(input.contactName).toBe(" Alex Example ");
  });

  it("allows pending households to correct their own details without approving them", async () => {
    const { app, record, principal, input } = setup();
    record.status = "pending";
    record.members.forEach((member) => { member.status = "pending"; });
    const result = await app.updateDetails.execute(principal, 3, input);
    expect(result.status).toBe("pending");
  });

  it("does not change pending member approval on name correction", async () => {
    const { app, input, principal } = setup();
    input.members = [{ id: "member-2", name: "Sam Example" }];
    const result = await app.updateDetails.execute(principal, 3, input);
    expect(result.members).toEqual([{ id: "member-2", name: "Sam Example", status: "pending" }]);
  });

  it("preserves rejection on a name correction", async () => {
    const { app, record, input, principal } = setup();
    record.members[1].status = "revoked";
    input.members = [
      { id: "member-1", name: "Alex" },
      { id: "member-2", name: "Sam Rejected" },
    ];
    const result = await app.updateDetails.execute(principal, 3, input);
    expect(result.members[1]).toEqual({ id: "member-2", name: "Sam Rejected", status: "revoked" });
    expect(result.status).toBe("approved");
  });

  it("derives pending after removing the last approved member", async () => {
    const { app, input, principal } = setup();
    input.members = [{ id: "member-2", name: "Sam" }];
    const result = await app.updateDetails.execute(principal, 3, input);
    expect(result.members).toEqual([{ id: "member-2", name: "Sam", status: "pending" }]);
    expect(result.status).toBe("pending");
  });

  it("never accepts household identity or approval in guest input", async () => {
    const { app, households, principal, input } = setup();
    for (const injected of [{ householdId: "other" }, { status: "approved" }, { revision: 99 }]) {
      await expect(app.updateDetails.execute(principal, 3, { ...input, ...injected })).rejects.toMatchObject({ code: "UNKNOWN_FIELD" });
    }
    expect(households.writes).toBe(0);
  });

  it("refuses member IDs that do not belong to the authenticated household", async () => {
    const { app, households, input, principal } = setup();
    input.members = [{ id: "another-household-member", name: "Other" }];
    await expect(app.updateDetails.execute(principal, 3, input)).rejects.toMatchObject({ code: "UNKNOWN_MEMBER_ID" });
    expect(households.writes).toBe(0);
  });

  it("refuses a revoked household even when its input is otherwise valid", async () => {
    const { app, households, record, principal, input } = setup();
    record.status = "revoked";
    await expect(app.updateDetails.execute(principal, 3, input)).rejects.toMatchObject({ code: "ACCESS_REVOKED" });
    expect(households.writes).toBe(0);
  });

  it("refuses missing households", async () => {
    const { app, input } = setup();
    await expect(app.updateDetails.execute({ householdId: "missing" }, 3, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([2, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects stale or invalid revision %s", async (revision) => {
    const { app, households, memberIds, principal, input } = setup();
    await expect(app.updateDetails.execute(principal, revision, input)).rejects.toMatchObject({ code: "STALE_HOUSEHOLD" });
    expect(households.writes).toBe(0);
    expect(memberIds.count).toBe(0);
  });

  it("does not overwrite approval/deletion changes between read and write", async () => {
    const { app, households, principal, input } = setup();
    households.concurrentChange = true;
    await expect(app.updateDetails.execute(principal, 3, input)).rejects.toMatchObject({ code: "STALE_HOUSEHOLD" });
    expect(households.writes).toBe(0);
    expect(households.record?.revision).toBe(3);
  });

  it.each(["", "invalid id"])("translates malformed allocated IDs into a safe application error: %s", async (id) => {
    const { households, principal, input } = setup();
    const app = createHouseholdApplication({ households, memberIds: { next: () => id } });
    await expect(app.updateDetails.execute(principal, 3, input)).rejects.toMatchObject({ code: "IDENTIFIER_FAILURE" });
    expect(households.writes).toBe(0);
  });

  it("does not expose generator exceptions", async () => {
    const { households, principal, input } = setup();
    const app = createHouseholdApplication({ households, memberIds: { next() { throw new Error("private infrastructure detail"); } } });
    await expect(app.updateDetails.execute(principal, 3, input)).rejects.toMatchObject({ code: "IDENTIFIER_FAILURE" });
    expect(households.writes).toBe(0);
  });

  it("rejects faulty ID allocation rather than merging member identities", async () => {
    const { households, principal, input } = setup();
    const app = createHouseholdApplication({ households, memberIds: { next: () => "member-1" } });
    await expect(app.updateDetails.execute(principal, 3, input)).rejects.toMatchObject({ code: "IDENTIFIER_FAILURE" });
    expect(households.writes).toBe(0);
  });
});
