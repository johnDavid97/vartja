import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type {
  HouseholdCredentialService,
  InvitationKeyService,
  ProtectedHouseholdCode,
  ValidatedRegistration,
} from "../application/HouseholdRegistration";

const base32Alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const derivationSalt = Buffer.from("sammen/household-access/v1", "utf8");

function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), derivationSalt, Buffer.from(purpose), 32));
}

function digest(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("base64url");
}

function decodeCanonicalBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encrypted credential");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw new Error("Invalid encrypted credential");
  return decoded;
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let accumulator = 0;
  let output = "";
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += base32Alphabet[(accumulator >>> bits) & 31];
    }
  }
  if (bits > 0) output += base32Alphabet[(accumulator << (5 - bits)) & 31];
  return output;
}

export function assertHouseholdAccessSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < 32) {
    throw new Error("HOUSEHOLD_ACCESS_SECRET must contain at least 32 characters");
  }
}

/** Cryptographic operations use independently derived keys for each purpose. */
export class HouseholdCredentialProtection implements HouseholdCredentialService {
  private readonly encryptionKey: Buffer;
  private readonly codeLookupKey: Buffer;
  private readonly requestLookupKey: Buffer;
  private readonly fingerprintKey: Buffer;

  constructor(secret: string) {
    assertHouseholdAccessSecret(secret);
    this.encryptionKey = deriveKey(secret, "access-code-encryption");
    this.codeLookupKey = deriveKey(secret, "access-code-lookup");
    this.requestLookupKey = deriveKey(secret, "registration-request-lookup");
    this.fingerprintKey = deriveKey(secret, "registration-content-fingerprint");
  }

  lookupDigest(code: string): string {
    return digest(this.codeLookupKey, code);
  }

  requestDigest(requestKey: string): string {
    return digest(this.requestLookupKey, requestKey);
  }

  requestFingerprint(registration: Omit<ValidatedRegistration, "requestKey">): string {
    return digest(this.fingerprintKey, JSON.stringify(registration));
  }

  generateCode(): string {
    const ungrouped = encodeBase32(randomBytes(15)); // 120 random bits.
    return ungrouped.match(/.{1,4}/g)!.join("-");
  }

  protectCode(code: string, householdPublicId: string): ProtectedHouseholdCode {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, nonce);
    cipher.setAAD(this.associatedData(householdPublicId));
    const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();
    return {
      digest: this.lookupDigest(code),
      encrypted: ["v1", nonce.toString("base64url"), ciphertext.toString("base64url"), authenticationTag.toString("base64url")].join("."),
    };
  }

  revealCode(encryptedCode: string, householdPublicId: string): string {
    const [version, nonceValue, ciphertextValue, tagValue, extra] = encryptedCode.split(".");
    if (version !== "v1" || !nonceValue || !ciphertextValue || !tagValue || extra !== undefined) {
      throw new Error("Invalid encrypted credential");
    }
    const nonce = decodeCanonicalBase64Url(nonceValue);
    const ciphertext = decodeCanonicalBase64Url(ciphertextValue);
    const authenticationTag = decodeCanonicalBase64Url(tagValue);
    if (nonce.length !== 12 || authenticationTag.length !== 16) throw new Error("Invalid encrypted credential");

    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, nonce);
    decipher.setAAD(this.associatedData(householdPublicId));
    decipher.setAuthTag(authenticationTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  private associatedData(householdPublicId: string): Buffer {
    return Buffer.from(`sammen/household-access-code/v1/${householdPublicId}`, "utf8");
  }
}

export class StableInvitationKey implements InvitationKeyService {
  private readonly invitationKey: string;

  constructor(secret: string) {
    assertHouseholdAccessSecret(secret);
    const key = deriveKey(secret, "shared-registration-invitation");
    this.invitationKey = `inv_${createHmac("sha256", key).update("shared-v1").digest("base64url")}`;
  }

  getKey(): string {
    return this.invitationKey;
  }

  verify(candidate: string): boolean {
    const expected = Buffer.from(this.invitationKey, "utf8");
    const submitted = Buffer.from(candidate, "utf8");
    // timingSafeEqual requires equal lengths. Compare fixed-sized hashes so even
    // malformed candidates take the same constant-time primitive path.
    const expectedHash = createHmac("sha256", expected).update(expected).digest();
    const submittedHash = createHmac("sha256", expected).update(submitted).digest();
    return timingSafeEqual(expectedHash, submittedHash);
  }
}
