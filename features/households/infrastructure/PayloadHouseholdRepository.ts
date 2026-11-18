import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";
import type { Household } from "../../../payload-types";
import { trustedAdminHouseholdCreationContext } from "../../../collections/Households";
import type { ApprovedHouseholdRepository } from "../application/CreateApprovedHousehold";
import type { HouseholdSummary, HouseholdSummaryRepository } from "../application/GetHouseholdSummary";
import type {
  CreateRegistrationResult, ProtectedHouseholdCode, RegistrationRepository, StoredRegistration,
} from "../application/HouseholdRegistration";
import type { HouseholdCodeRecord, HouseholdCodeRepository, HouseholdCredentialAudit } from "../application/HouseholdCodeServices";

type RegistrationFields = Pick<Household,
  "id" | "publicId" | "registrationRequestFingerprint" | "accessCodeEncrypted" | "credentialVersion" | "status"
>;

function asStoredRegistration(household: RegistrationFields): StoredRegistration {
  return {
    householdId: household.id,
    publicId: household.publicId,
    requestFingerprint: household.registrationRequestFingerprint,
    encryptedCode: household.accessCodeEncrypted,
    credentialVersion: household.credentialVersion,
    status: household.status,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  let currentError = error;
  for (let depth = 0; depth < 5 && currentError && typeof currentError === "object"; depth += 1) {
    const databaseError = currentError as { code?: unknown; cause?: unknown };
    if (databaseError.code === "23505") return true;
    currentError = databaseError.cause;
  }
  return false;
}

/** Server-only persistence. Ordinary Payload reads never receive credential fields. */
export class PayloadHouseholdRepository implements
  RegistrationRepository, ApprovedHouseholdRepository, HouseholdCodeRepository, HouseholdSummaryRepository {
  constructor(private readonly payload: Payload) {}

  async create(input: Parameters<RegistrationRepository["create"]>[0]): Promise<CreateRegistrationResult> {
    return this.createInitial(input, "pending");
  }

  async createApproved(input: Parameters<ApprovedHouseholdRepository["createApproved"]>[0]): Promise<CreateRegistrationResult> {
    return this.createInitial(input, "approved");
  }

  async getSummary(): Promise<HouseholdSummary> {
    // Both counts must describe one snapshot, even while registrations arrive.
    const result = await this.payload.db.drizzle.execute(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE "status" = 'pending') AS pending
      FROM "households"
    `);
    return { total: Number(result.rows[0].total), pending: Number(result.rows[0].pending) };
  }

  async findCredentials(householdId: number): Promise<HouseholdCodeRecord | null> {
    const { docs } = await this.payload.find({
      collection: "households", overrideAccess: true, showHiddenFields: true,
      limit: 1, depth: 0, pagination: false,
      where: { id: { equals: householdId } },
      select: { publicId: true, accessCodeEncrypted: true, credentialVersion: true },
    });
    const household = docs[0];
    if (!household) return null;
    return {
      householdId: household.id, publicId: household.publicId,
      encryptedCode: household.accessCodeEncrypted, credentialVersion: household.credentialVersion,
    };
  }

  async rotateCredentials(
    householdId: number,
    expectedCredentialVersion: number,
    code: ProtectedHouseholdCode,
    audit: HouseholdCredentialAudit,
  ): Promise<boolean> {
    try {
      // A Payload bulk update first selects documents; its WHERE is not an atomic
      // compare-and-swap. Keep this credential-only mutation in one SQL statement.
      return await this.payload.db.drizzle.transaction(async (transaction) => {
        const result = await transaction.execute(sql`
        UPDATE "households"
        SET "access_code_digest" = ${code.digest}, "access_code_encrypted" = ${code.encrypted},
            "credential_version" = "credential_version" + 1,
            "revision" = "revision" + 1, "updated_at" = now()
        WHERE "id" = ${householdId} AND "credential_version" = ${expectedCredentialVersion}
        RETURNING "id"
        `);
        if (result.rows.length !== 1) return false;
        await transaction.execute(sql`
          INSERT INTO "household_credential_audits"
            ("household", "administrator", "action", "occurred_at", "created_at", "updated_at")
          VALUES (${householdId}, ${audit.administratorId}, 'rotate', ${audit.occurredAt.toISOString()}, now(), now())
        `);
        return true;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return false;
      throw error;
    }
  }

  private async createInitial(
    input: Parameters<RegistrationRepository["create"]>[0] | Parameters<ApprovedHouseholdRepository["createApproved"]>[0],
    status: "pending" | "approved",
  ): Promise<CreateRegistrationResult> {
    const existing = await this.findByRequestDigest(input.requestDigest);
    if (existing) return { kind: "existing", registration: existing };

    try {
      // One Payload create transaction persists the complete household, credential,
      // and member rows; an approved household is never stored in a pending state.
      const context = status === "approved"
        ? trustedAdminHouseholdCreationContext()
        : { householdTrustedRegistration: true };
      const household = await this.payload.create({
        collection: "households", overrideAccess: true, showHiddenFields: true,
        context,
        data: {
          publicId: input.publicId, contactName: input.contactName,
          displayName: input.displayName ?? input.contactName,
          email: input.email, status, members: input.members, revision: 0, credentialVersion: 1, sessionVersion: 1,
          accessCodeDigest: input.code.digest, accessCodeEncrypted: input.code.encrypted,
          registrationRequestDigest: input.requestDigest,
          registrationRequestFingerprint: input.requestFingerprint,
        },
      });
      return { kind: "created", registration: asStoredRegistration(household) };
    } catch (error) {
      // The unique request digest serializes concurrent retries. Return the winner
      // without updating status or credentials, including after revocation.
      const winner = await this.findByRequestDigest(input.requestDigest);
      if (winner) return { kind: "existing", registration: winner };
      if (isUniqueConstraintError(error)) return { kind: "credential-conflict" };
      throw error;
    }
  }

  private async findByRequestDigest(requestDigest: string): Promise<StoredRegistration | null> {
    const { docs } = await this.payload.find({
      collection: "households", overrideAccess: true, showHiddenFields: true,
      limit: 1, depth: 0, pagination: false,
      where: { registrationRequestDigest: { equals: requestDigest } },
      select: {
        publicId: true, registrationRequestFingerprint: true,
        accessCodeEncrypted: true, credentialVersion: true, status: true,
      },
    });
    return docs[0] ? asStoredRegistration(docs[0]) : null;
  }
}
