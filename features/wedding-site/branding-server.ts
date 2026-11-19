import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { weddingBranding, weddingTitle } from "./branding";
import { weddingIcons } from "./icons";

/** Public identity only; request-local cache, never a cross-request copy of CMS settings. */
export const getWeddingBranding = cache(async () => {
  await connection();
  try {
    const payload = await getPayload({ config });
    const wedding = await payload.findGlobal({
      slug: "wedding", depth: 0, overrideAccess: false, select: { coupleNames: true },
    });
    return weddingBranding(wedding.coupleNames);
  } catch {
    console.warn("Could not load wedding branding; using a neutral fallback.");
    return weddingBranding();
  }
});

/** Full strings rather than templates: literal %s in configured names stays literal. */
export async function weddingPageMetadata(page: string) {
  const branding = await getWeddingBranding();
  return { title: weddingTitle(page, branding), icons: weddingIcons(branding) };
}
