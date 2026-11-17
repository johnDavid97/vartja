import { HouseholdError } from "../domain/errors";
import { MAX_MEMBERS, validateHouseholdInput, validateMemberId } from "../domain/validation";

export type RegistrationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_INVITATION"
  | "IDEMPOTENCY_CONFLICT"
  | "RECOVERY_UNAVAILABLE"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "IDENTIFIER_FAILURE"
  | "SERVICE_UNAVAILABLE";

const errorDetails: Record<RegistrationErrorCode, { message: string; status: number }> = {
  INVALID_INPUT: { message: "Registreringsopplysningene er ugyldige.", status: 400 },
  INVALID_INVITATION: { message: "Invitasjonen er ugyldig.", status: 403 },
  IDEMPOTENCY_CONFLICT: { message: "Forespørselsnøkkelen er allerede brukt med andre opplysninger.", status: 409 },
  RECOVERY_UNAVAILABLE: { message: "Husstanden er allerede behandlet. Kontakt brudeparet for å få koden.", status: 409 },
  RATE_LIMITED: { message: "For mange registreringsforsøk. Prøv igjen senere.", status: 429 },
  NOT_FOUND: { message: "Fant ikke husstanden.", status: 404 },
  IDENTIFIER_FAILURE: { message: "Kunne ikke opprette husstanden. Prøv igjen.", status: 503 },
  SERVICE_UNAVAILABLE: { message: "Tjenesten er midlertidig utilgjengelig.", status: 503 },
};

/** The only errors HTTP adapters may serialize. */
export class HouseholdRegistrationError extends Error {
  readonly httpStatus: number;

  constructor(readonly code: RegistrationErrorCode) {
    super(errorDetails[code].message);
    this.name = "HouseholdRegistrationError";
    this.httpStatus = errorDetails[code].status;
  }
}

export interface ValidatedRegistration {
  requestKey: string;
  contactName: string;
  email: string;
  memberNames: string[];
}

export interface ProtectedHouseholdCode {
  digest: string;
  encrypted: string;
}

export interface StoredRegistration {
  householdId: number;
  status: "pending" | "approved" | "revoked";
  publicId: string;
  requestFingerprint: string;
  encryptedCode: string;
  credentialVersion: number;
}

export type CreateRegistrationResult =
  | { kind: "created"; registration: StoredRegistration }
  | { kind: "existing"; registration: StoredRegistration }
  | { kind: "credential-conflict" };

export interface RegistrationRepository {
  create(input: {
    publicId: string;
    contactName: string;
    email: string;
    members: { memberId: string; name: string; status: "pending" }[];
    requestDigest: string;
    requestFingerprint: string;
    code: ProtectedHouseholdCode;
  }): Promise<CreateRegistrationResult>;
}

export interface RegistrationAttemptLimiter {
  consume(): Promise<boolean>;
}

export interface InvitationKeyService {
  getKey(): string;
  verify(candidate: string): boolean;
}

export interface HouseholdCredentialService {
  requestDigest(requestKey: string): string;
  requestFingerprint(registration: Omit<ValidatedRegistration, "requestKey">): string;
  generateCode(): string;
  protectCode(code: string, householdPublicId: string): ProtectedHouseholdCode;
  revealCode(encryptedCode: string, householdPublicId: string): string;
}

export interface RegistrationIdentifierSource {
  publicId(): string;
  memberId(): string;
}

const registrationFields = ["invitationKey", "requestKey", "contactName", "email", "additionalMembers"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRegistration(value: unknown): { invitationKey: string; registration: ValidatedRegistration } {
  if (!isRecord(value)) throw new HouseholdRegistrationError("INVALID_INPUT");
  const fields = Object.keys(value);
  if (fields.some((field) => !(registrationFields as readonly string[]).includes(field))) {
    throw new HouseholdRegistrationError("INVALID_INPUT");
  }
  if (!Object.hasOwn(value, "invitationKey") || typeof value.invitationKey !== "string") {
    throw new HouseholdRegistrationError("INVALID_INVITATION");
  }
  if (fields.length !== registrationFields.length || registrationFields.some((field) => !Object.hasOwn(value, field))) {
    throw new HouseholdRegistrationError("INVALID_INPUT");
  }
  if (typeof value.requestKey !== "string" || !uuidPattern.test(value.requestKey)) {
    throw new HouseholdRegistrationError("INVALID_INPUT");
  }
  if (!Array.isArray(value.additionalMembers) || value.additionalMembers.length >= MAX_MEMBERS) {
    throw new HouseholdRegistrationError("INVALID_INPUT");
  }
  if (value.additionalMembers.some((member) =>
    !isRecord(member) || Object.keys(member).length !== 1 || !Object.hasOwn(member, "name")
  )) {
    throw new HouseholdRegistrationError("INVALID_INPUT");
  }

  try {
    // Reuse the domain's normalization and strict member shape validation. The
    // contact is prepended here, once, rather than in general household edits.
    const details = validateHouseholdInput({
      contactName: value.contactName,
      email: value.email,
      members: [{ name: value.contactName }, ...value.additionalMembers],
    });
    return {
      invitationKey: value.invitationKey,
      registration: {
        requestKey: value.requestKey.toLowerCase(),
        contactName: details.contactName,
        email: details.email,
        memberNames: details.members.map(({ name }) => name),
      },
    };
  } catch (error) {
    if (error instanceof HouseholdError) throw new HouseholdRegistrationError("INVALID_INPUT");
    throw error;
  }
}

export class RegisterHousehold {
  constructor(
    private readonly repository: RegistrationRepository,
    private readonly limiter: RegistrationAttemptLimiter,
    private readonly invitations: InvitationKeyService,
    private readonly credentials: HouseholdCredentialService,
    private readonly identifiers: RegistrationIdentifierSource,
  ) {}

  async register(input: unknown): Promise<{ householdId: number; accessCode: string; status: "pending" }> {
    const { invitationKey, registration } = validateRegistration(input);
    let invitationIsValid: boolean;
    try {
      invitationIsValid = this.invitations.verify(invitationKey);
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }
    if (!invitationIsValid) throw new HouseholdRegistrationError("INVALID_INVITATION");

    // Public requests with no valid invitation must not exhaust the guests' allowance.
    let permitted: boolean;
    try {
      permitted = await this.limiter.consume();
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }
    if (!permitted) throw new HouseholdRegistrationError("RATE_LIMITED");

    const normalizedContent = {
      contactName: registration.contactName,
      email: registration.email,
      memberNames: registration.memberNames,
    };
    let requestDigest: string;
    let requestFingerprint: string;
    try {
      requestDigest = this.credentials.requestDigest(registration.requestKey);
      requestFingerprint = this.credentials.requestFingerprint(normalizedContent);
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let publicId: string;
      let accessCode: string;
      let code: ProtectedHouseholdCode;
      let members: { memberId: string; name: string; status: "pending" }[];
      try {
        publicId = this.identifiers.publicId();
        if (!uuidPattern.test(publicId)) throw new Error("Invalid public identifier");
        accessCode = this.credentials.generateCode();
        code = this.credentials.protectCode(accessCode, publicId);
        const allocatedMemberIds = new Set<string>();
        members = registration.memberNames.map((name) => {
          const memberId = validateMemberId(this.identifiers.memberId());
          if (allocatedMemberIds.has(memberId)) throw new Error("Duplicate member identifier");
          allocatedMemberIds.add(memberId);
          return { memberId, name, status: "pending" as const };
        });
      } catch {
        throw new HouseholdRegistrationError("IDENTIFIER_FAILURE");
      }

      let result: CreateRegistrationResult;
      try {
        result = await this.repository.create({
          publicId,
          contactName: registration.contactName,
          email: registration.email,
          members,
          requestDigest,
          requestFingerprint,
          code,
        });
      } catch {
        throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
      }

      if (result.kind === "credential-conflict") continue;
      if (result.registration.requestFingerprint !== requestFingerprint) {
        throw new HouseholdRegistrationError("IDEMPOTENCY_CONFLICT");
      }
      const returnedCode = result.kind === "created"
        ? accessCode
        : this.revealExistingCode(result.registration);
      return { householdId: result.registration.householdId, accessCode: returnedCode, status: "pending" };
    }
    throw new HouseholdRegistrationError("IDENTIFIER_FAILURE");
  }

  private revealExistingCode(registration: StoredRegistration): string {
    // A request key must never recover a replacement code or bypass approval/revocation.
    if (registration.credentialVersion !== 1 || registration.status !== "pending") {
      throw new HouseholdRegistrationError("RECOVERY_UNAVAILABLE");
    }
    try {
      return this.credentials.revealCode(registration.encryptedCode, registration.publicId);
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }
  }
}
