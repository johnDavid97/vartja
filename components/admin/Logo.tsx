import { getWeddingBranding } from "@/features/wedding-site/branding-server";

export default async function Logo() {
  const branding = await getWeddingBranding();

  return <span className="wedding-admin-logo"><span className="wedding-monogram" aria-hidden="true">{branding.monogram}</span><span className="wedding-admin-logo__names">{branding.names}</span></span>;
}
