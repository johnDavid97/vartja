import "server-only";
import { cache } from "react";
import { getWebsiteViewer, requireApprovedViewer } from "@/features/households/auth/server";
import { LoadHomepage } from "./application/LoadHomepage";
import { PayloadHomepageRepository } from "./infrastructure/PayloadHomepageRepository";

const getHomepageReader = cache(async () => {
  const viewer = await getWebsiteViewer();
  return new LoadHomepage(new PayloadHomepageRepository(viewer.payload, viewer.req));
});

// React cache deduplicates header/page reads within one request, not across guests or edits.
export const getHomepageSettings = cache(async () => (await getHomepageReader()).settings());
export const getHomepageUpdates = cache(async () => {
  await requireApprovedViewer();
  return (await getHomepageReader()).updates();
});
