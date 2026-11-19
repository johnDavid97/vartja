import type { Wedding } from "@/payload-types";
import type { HomepageSettings } from "./models";
import { isHexColor } from "@/lib/colors";
import { weddingBranding } from "@/features/wedding-site/branding";

export const DEFAULT_HERO_COLOR = "#3c4641";
export const DEFAULT_WEDDING_DATE = "2027-07-27T00:00:00+02:00";

function focalPosition(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
}

/** Presentation defaults never mutate existing CMS records. */
export function toHomepageSettings(wedding: Wedding): HomepageSettings {
  const photo = typeof wedding.heroImage === "object" ? wedding.heroImage : null;
  return {
    names: weddingBranding(wedding.coupleNames).names,
    date: wedding.weddingDate || DEFAULT_WEDDING_DATE,
    venue: wedding.venue?.trim() || "",
    welcomeMessage: wedding.welcomeMessage?.trim() || "",
    heroEyebrow: wedding.heroEyebrow ?? "Vi gifter oss",
    heroTitleSuffix: wedding.heroTitleSuffix ?? "sitt bryllup",
    backgroundMode: wedding.heroBackgroundMode === "image" ? "image" : "color",
    backgroundColor: isHexColor(wedding.heroBackgroundColor) ? wedding.heroBackgroundColor : DEFAULT_HERO_COLOR,
    image: photo?.url ? { src: photo.url, alt: photo.alt, focalX: focalPosition(photo.focalX), focalY: focalPosition(photo.focalY) } : null,
  };
}
