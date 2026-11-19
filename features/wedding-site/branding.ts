export type WeddingBranding = { names: string; monogram: string };

export const DEFAULT_WEDDING_NAMES = "Bryllupet vårt";

function initial(name: string): string {
  return Array.from(name.trim().normalize("NFC"))[0]?.toLocaleUpperCase("nb-NO") || "";
}

/** Presentation only: a changed name must never change URLs, credentials or ownership. */
export function weddingBranding(value?: string | null): WeddingBranding {
  const names = value?.trim() || DEFAULT_WEDDING_NAMES;
  if (names === DEFAULT_WEDDING_NAMES) return { names, monogram: "♡" };

  const partners = names.split(/\s*(?:&|\bog\b|\+)\s*/iu).filter((part) => part.trim());
  const monogram = partners.length >= 2
    ? `${initial(partners[0])}&${initial(partners.at(-1)!)}`
    : names.split(/\s+/u).slice(0, 2).map(initial).join("");
  return { names, monogram: monogram || "♡" };
}

export function weddingTitle(page: string, branding: WeddingBranding): string {
  return `${page} · ${branding.names}`;
}
