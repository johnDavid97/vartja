export class InvalidInvitationOriginError extends Error {
  constructor() {
    super("Nettsidens offentlige adresse er ugyldig. Kontroller PUBLIC_SITE_URL.");
    this.name = "InvalidInvitationOriginError";
  }
}

interface InvitationUrlOptions {
  requestUrl: string;
  invitationKey: string;
  publicSiteUrl?: string;
}

/** Prefer the configured public domain over a proxy, preview or local admin address. */
export function buildInvitationUrl({ requestUrl, invitationKey, publicSiteUrl }: InvitationUrlOptions): string {
  const configuredOrigin = publicSiteUrl?.trim();
  let siteUrl: URL;
  try {
    siteUrl = new URL(configuredOrigin || requestUrl);
  } catch {
    throw new InvalidInvitationOriginError();
  }

  const isLocalDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(siteUrl.hostname);
  const hasSecureProtocol = siteUrl.protocol === "https:" || (siteUrl.protocol === "http:" && isLocalDevelopment);
  const hasUnexpectedLocation = configuredOrigin && (siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash);
  if (!hasSecureProtocol || siteUrl.username || siteUrl.password || hasUnexpectedLocation) {
    throw new InvalidInvitationOriginError();
  }

  const registrationUrl = new URL("/register", siteUrl.origin);
  registrationUrl.hash = new URLSearchParams({ invitation: invitationKey }).toString();
  return registrationUrl.toString();
}
