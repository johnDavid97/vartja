import { withWebsiteAccess } from "@/components/households/withWebsiteAccess";
import { weddingPageMetadata } from "@/features/wedding-site/branding-server";

export async function generateMetadata() { return weddingPageMetadata("Bilder"); }

export default withWebsiteAccess(Page);
function Page() {
  return (
    <main className="px-6 py-24 text-center">
      <h1 className="font-serif text-5xl">Bilder</h1>
      <p className="mt-6 text-stone-600">Her kommer bilder fra feiringen.</p>
    </main>
  );
}
