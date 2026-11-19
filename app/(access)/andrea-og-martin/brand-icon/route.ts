import { getWeddingBranding } from "@/features/wedding-site/branding-server";
import { monogramIconSvg } from "@/features/wedding-site/icons";

/** Public configured initials only. Never render arbitrary query-string text. */
export async function GET() {
  const branding = await getWeddingBranding();
  return new Response(monogramIconSvg(branding.monogram), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
