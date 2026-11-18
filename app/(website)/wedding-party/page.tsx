import { withWebsiteAccess } from "@/components/households/withWebsiteAccess";

export default withWebsiteAccess(Page);
function Page() {
  return (
    <main className="px-6 py-24 text-center">
      <h1 className="font-serif text-5xl">Wedding Party</h1>
      <p className="mt-6 text-stone-600">Bli kjent med forloverne våre – mer informasjon kommer snart.</p>
    </main>
  );
}
