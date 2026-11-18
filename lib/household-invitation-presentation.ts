export type HouseholdInvitationDetails = {
  registrationUrl: string;
  qrDataUrl: string;
  qrSvg: string;
};

export type HouseholdInvitationPresentation = {
  host: string;
  isLocal: boolean;
  maskedUrl: string;
};

function parseRegistrationUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!new URLSearchParams(url.hash.slice(1)).get('invitation')) return null;
    return url;
  } catch {
    return null;
  }
}

function isSafeQrSvg(value: string): boolean {
  const svg = value.trim();
  return (
    svg.startsWith('<svg ') &&
    svg.endsWith('</svg>') &&
    !/<(?:script|foreignObject|iframe|object|embed)\b/i.test(svg) &&
    !/\bon[a-z]+\s*=|javascript:/i.test(svg)
  );
}

/** Validate all browser-facing values before they are used in src or href attributes. */
export function parseHouseholdInvitationDetails(value: unknown): HouseholdInvitationDetails | null {
  if (typeof value !== 'object' || value === null) return null;
  const details = value as Record<string, unknown>;
  if (
    typeof details.registrationUrl !== 'string' ||
    !parseRegistrationUrl(details.registrationUrl) ||
    typeof details.qrDataUrl !== 'string' ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(details.qrDataUrl) ||
    typeof details.qrSvg !== 'string' ||
    !isSafeQrSvg(details.qrSvg)
  ) {
    return null;
  }

  return {
    registrationUrl: details.registrationUrl,
    qrDataUrl: details.qrDataUrl,
    qrSvg: details.qrSvg,
  };
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    normalized === '::' ||
    normalized === '0.0.0.0'
  ) {
    return true;
  }

  const ipv4 = normalized.split('.').map(Number);
  return ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) && ipv4[0] === 127;
}

export function presentHouseholdInvitation(registrationUrl: string): HouseholdInvitationPresentation {
  const url = parseRegistrationUrl(registrationUrl);
  if (!url) throw new Error('Invalid registration URL');

  const hashStart = registrationUrl.indexOf('#');
  const prefix = registrationUrl.slice(0, hashStart + 1);
  const fragment = registrationUrl.slice(hashStart + 1);
  const maskedFragment = fragment.replace(
    /(^|&)invitation=([^&]+)/,
    (_match, separator: string) => `${separator}invitation=${'•'.repeat(12)}`,
  );

  return {
    host: url.host,
    isLocal: isLocalHostname(url.hostname),
    maskedUrl: `${prefix}${maskedFragment}`,
  };
}
