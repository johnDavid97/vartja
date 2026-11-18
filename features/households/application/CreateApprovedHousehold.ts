import { HouseholdError } from "../domain/errors";
import { validateInitialHousehold } from "../domain/initial-household";
import { provisionInitialHousehold } from "./InitialHouseholdProvisioning";
import {
  HouseholdRegistrationError,
  type CreateRegistrationResult,
  type HouseholdCredentialService,
  type ProtectedHouseholdCode,
  type RegistrationIdentifierSource,
} from "./HouseholdRegistration";

export interface ApprovedHouseholdRepository {
  createApproved(input: {
    publicId: string;
    contactName: string;
    email: string;
    members: { memberId: string; name: string; status: "approved" }[];
    requestDigest: string;
    requestFingerprint: string;
    code: ProtectedHouseholdCode;
  }): Promise<CreateRegistrationResult>;
}

function validateAdministratorId(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new HouseholdRegistrationError("INVALID_INPUT");
}

/** Create a fully approved household without exposing its generated credential. */
export class CreateApprovedHousehold {
  constructor(
    private readonly repository: ApprovedHouseholdRepository,
    private readonly credentials: HouseholdCredentialService,
    private readonly identifiers: RegistrationIdentifierSource,
  ) {}

  async create(input: unknown, administratorId: number): Promise<{ householdId: number }> {
    validateAdministratorId(administratorId);
    let household;
    try {
      household = validateInitialHousehold(input);
    } catch (error) {
      if (error instanceof HouseholdError) throw new HouseholdRegistrationError("INVALID_INPUT");
      throw error;
    }

    const normalizedContent = {
      contactName: household.contactName,
      email: household.email,
      memberNames: household.memberNames,
    };
    let requestDigest: string;
    let requestFingerprint: string;
    try {
      // The domain and authenticated administrator are part of the durable key namespace.
      requestDigest = this.credentials.requestDigest(
        `administrator-household-creation/v1/${administratorId}/${household.requestKey}`,
      );
      requestFingerprint = this.credentials.requestFingerprint(normalizedContent);
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let provisioned;
      try {
        provisioned = provisionInitialHousehold(
          household.memberNames, "approved", this.credentials, this.identifiers,
        );
      } catch {
        throw new HouseholdRegistrationError("IDENTIFIER_FAILURE");
      }

      let result: CreateRegistrationResult;
      try {
        result = await this.repository.createApproved({
          publicId: provisioned.publicId,
          contactName: household.contactName,
          email: household.email,
          members: provisioned.members,
          requestDigest,
          requestFingerprint,
          code: provisioned.code,
        });
      } catch {
        throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
      }
      if (result.kind === "credential-conflict") continue;
      if (result.registration.requestFingerprint !== requestFingerprint) {
        throw new HouseholdRegistrationError("IDEMPOTENCY_CONFLICT");
      }
      // Existing retries are deliberately read-only, regardless of current status
      // or credential version, so revocation and later rotations are preserved.
      return { householdId: result.registration.householdId };
    }
    throw new HouseholdRegistrationError("IDENTIFIER_FAILURE");
  }
}
