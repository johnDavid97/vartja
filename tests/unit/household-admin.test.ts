import { describe, expect, it } from "vitest";
import {
  CreateApprovedHousehold,
  type ApprovedHouseholdRepository,
} from "../../features/households/application/CreateApprovedHousehold";
import { GetHouseholdSummary } from "../../features/households/application/GetHouseholdSummary";
import type { CreateRegistrationResult, StoredRegistration } from "../../features/households/application/HouseholdRegistration";
import { HouseholdCredentialProtection } from "../../features/households/infrastructure/HouseholdCredentialProtection";

const secret = "test-only-household-secret-that-is-at-least-32-characters";
const requestKey = "123e4567-e89b-42d3-a456-426614174000";

class FakeApprovedRepository implements ApprovedHouseholdRepository {
  readonly byDigest = new Map<string, StoredRegistration>();
  readonly received: Parameters<ApprovedHouseholdRepository["createApproved"]>[0][] = [];

  async createApproved(
    input: Parameters<ApprovedHouseholdRepository["createApproved"]>[0],
  ): Promise<CreateRegistrationResult> {
    this.received.push(structuredClone(input));
    const existing = this.byDigest.get(input.requestDigest);
    if (existing) return { kind: "existing", registration: existing };
    const registration: StoredRegistration = {
      householdId: this.byDigest.size + 1,
      status: "approved",
      publicId: input.publicId,
      requestFingerprint: input.requestFingerprint,
      encryptedCode: input.code.encrypted,
      credentialVersion: 1,
    };
    this.byDigest.set(input.requestDigest, registration);
    return { kind: "created", registration };
  }
}

function setup(repository = new FakeApprovedRepository()) {
  let memberSequence = 0;
  const credentials = new HouseholdCredentialProtection(secret);
  const service = new CreateApprovedHousehold(repository, credentials, {
    publicId: () => "00000000-0000-4000-8000-000000000001",
    memberId: () => `member-${++memberSequence}`,
  });
  const input = {
    requestKey,
    contactName: " Kari Nordmann ",
    email: " KARI@example.com ",
    additionalMembers: [{ name: "Ola" }],
  };
  return { credentials, input, repository, service };
}

describe("administrator household creation", () => {
  it("persists the contact once with a fully approved household and returns no credential", async () => {
    const { input, repository, service } = setup();
    const result = await service.create(input, 7);

    expect(result).toEqual({ householdId: 1 });
    expect(Object.keys(result)).toEqual(["householdId"]);
    expect(repository.received[0]).toMatchObject({
      contactName: "Kari Nordmann",
      email: "kari@example.com",
      members: [
        { name: "Kari Nordmann", status: "approved" },
        { name: "Ola", status: "approved" },
      ],
    });
  });

  it("namespaces durable request keys by administrator and creation domain", async () => {
    const { credentials, input, repository, service } = setup();
    await service.create(input, 7);
    await service.create(input, 8);

    const [first, second] = repository.received;
    expect(first.requestDigest).not.toBe(second.requestDigest);
    expect(first.requestDigest).not.toBe(credentials.requestDigest(requestKey));
  });

  it("treats concurrent identical retries idempotently", async () => {
    const { input, repository, service } = setup();
    const results = await Promise.all([service.create(input, 7), service.create(input, 7)]);
    expect(results).toEqual([{ householdId: 1 }, { householdId: 1 }]);
    expect(repository.byDigest.size).toBe(1);
  });

  it("rejects changed content but never reapproves or rotates an existing retry", async () => {
    const { input, repository, service } = setup();
    await service.create(input, 7);
    const stored = [...repository.byDigest.values()][0];
    stored.status = "revoked";
    stored.credentialVersion = 2;
    const encryptedCode = stored.encryptedCode;

    await expect(service.create(input, 7)).resolves.toEqual({ householdId: 1 });
    expect(stored).toMatchObject({ status: "revoked", credentialVersion: 2, encryptedCode });
    await expect(service.create({ ...input, contactName: "Someone else" }, 7)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      httpStatus: 409,
    });
  });

  it("rejects fields outside the exact request contract", async () => {
    const { input, service } = setup();
    await expect(service.create({ ...input, status: "approved" }, 7)).rejects.toMatchObject({
      code: "INVALID_INPUT",
      httpStatus: 400,
    });
  });
});

describe("household summary", () => {
  it("returns injected repository counts without credential configuration", async () => {
    const summary = new GetHouseholdSummary({ getSummary: async () => ({ total: 12, pending: 3 }) });
    await expect(summary.get()).resolves.toEqual({ total: 12, pending: 3 });
  });

  it("maps repository failures to a safe typed error", async () => {
    const summary = new GetHouseholdSummary({ getSummary: async () => { throw new Error("database detail"); } });
    await expect(summary.get()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", httpStatus: 503 });
  });
});
