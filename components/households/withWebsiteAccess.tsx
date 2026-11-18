import { Suspense, type ReactNode } from "react";
import { requireApprovedViewer } from "@/features/households/auth/server";

/** Check each page, not just a shared layout. Data loaders also enforce access independently. */
export function withWebsiteAccess<Props extends object>(Page: (props: Props) => ReactNode | Promise<ReactNode>) {
  async function AuthorizedPage(props: Props) {
    await requireApprovedViewer();
    return <Page {...props} />;
  }
  return function ProtectedPage(props: Props) {
    return <Suspense fallback={<main className="px-6 py-16 text-center"><p role="status">Sjekker tilgang …</p></main>}><AuthorizedPage {...props} /></Suspense>;
  };
}
