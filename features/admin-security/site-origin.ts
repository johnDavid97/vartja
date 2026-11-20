import { isIP } from "node:net";

export const LOCAL_ADMIN_ORIGIN = "http://localhost:3000";

export class InvalidPublicSiteURLError extends Error {
  constructor() {
    super("PUBLIC_SITE_URL must be an exact HTTPS origin (HTTP is allowed only for loopback).");
    this.name = "InvalidPublicSiteURLError";
  }
}

export type AdminSiteSecurity = {
  origin: string;
  secureCookies: boolean;
};

/** Resolve the one public origin trusted by Payload. Never derives it from a request. */
export function resolveAdminSiteSecurity(
  configuredURL: string | undefined,
  environment: string | undefined = "production",
): AdminSiteSecurity {
  const configured = configuredURL?.trim();
  const input = configured || LOCAL_ADMIN_ORIGIN;
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new InvalidPublicSiteURLError();
  }

  const loopback = isLoopbackHostname(url.hostname);
  const hasOnlyOrigin = url.pathname === "/" && url.search === "" && url.hash === ""
    && (url.href === `${url.origin}/`);

  if (
    !url.hostname
    || url.hostname.includes("*")
    || url.username !== ""
    || url.password !== ""
    || !hasOnlyOrigin
    || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  ) {
    throw new InvalidPublicSiteURLError();
  }

  return {
    origin: url.origin,
    // An unset deployment URL must not silently issue insecure administrator cookies.
    // Explicit HTTP loopback remains supported for local/disposable production-mode tests.
    secureCookies: url.protocol === "https:"
      || (!configured && environment !== "development" && environment !== "test"),
  };
}

function isLoopbackHostname(hostname: string): boolean {
  const unbracketed = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  if (unbracketed === "localhost") return true;
  if (isIP(unbracketed) === 4) return unbracketed.split(".")[0] === "127";
  return unbracketed === "::1";
}
