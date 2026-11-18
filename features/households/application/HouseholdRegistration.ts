import { HouseholdError } from "../domain/errors";
import { validateInitialHousehold } from "../domain/initial-household";
import { provisionInitialHousehold } from "./InitialHouseholdProvisioning";

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
  displayName?: string;
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
    displayName?: string;
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

const requiredRegistrationFields = ["invitationKey", "requestKey", "contactName", "email", "additionalMembers"] as const;
const registrationFields = [...requiredRegistrationFields, "displayName"] as const;
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
  if ((fields.length !== requiredRegistrationFields.length && fields.length !== registrationFields.length)
    || requiredRegistrationFields.some((field) => !Object.hasOwn(value, field))) {
    throw new HouseholdRegistrationError("INVALID_INPUT");
  }
  try {
    const registration = validateInitialHousehold({
      requestKey: value.requestKey,
      contactName: value.contactName,
      ...(Object.hasOwn(value, "displayName") ? { displayName: value.displayName } : {}),
      email: value.email,
      additionalMembers: value.additionalMembers,
    });
    return { invitationKey: value.invitationKey, registration };
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
      ...(registration.displayName === undefined ? {} : { displayName: registration.displayName }),
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
      let provisioned;
      try {
        provisioned = provisionInitialHousehold(
          registration.memberNames, "pending", this.credentials, this.identifiers,
        );
      } catch {
        throw new HouseholdRegistrationError("IDENTIFIER_FAILURE");
      }
      const { publicId, accessCode, code, members } = provisioned;

      let result: CreateRegistrationResult;
      try {
        result = await this.repository.create({
          publicId,
          contactName: registration.contactName,
          ...(registration.displayName === undefined ? {} : { displayName: registration.displayName }),
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
