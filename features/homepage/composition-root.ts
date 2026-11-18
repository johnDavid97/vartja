import "server-only";
import { cache } from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { LoadHomepage } from "./application/LoadHomepage";
import { PayloadHomepageRepository } from "./infrastructure/PayloadHomepageRepository";

const getHomepageReader = cache(async () => new LoadHomepage(new PayloadHomepageRepository(await getPayload({ config }))));

// React cache deduplicates header/page reads within one request, not across guests or edits.
export const getHomepageSettings = cache(async () => (await getHomepageReader()).settings());
export const getHomepageUpdates = cache(async () => (await getHomepageReader()).updates());
