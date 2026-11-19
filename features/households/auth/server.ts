import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import { getHouseholdAuthServices } from "./composition-root";
import { sessionTokenFromHeaders } from "../http/session-cookie";
import { weddingPath } from "@/features/wedding-site/paths";

/** A React render-pass cache, never a shared cross-visitor authorization cache. */
export const getWebsiteViewer = cache(async () => {
  // Session expiry uses the current clock; never evaluate it during partial prerender/prefetch.
  await connection();
  const requestHeaders = new Headers(await headers());
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: requestHeaders });
  const administrator = user?.collection === "users";
  const token = sessionTokenFromHeaders(requestHeaders);
  const household = token ? await getHouseholdAuthServices(payload).resolve(token) : null;
  return { administrator, household, payload, req: { headers: requestHeaders, user } };
});

export async function requireApprovedViewer() {
  const viewer = await getWebsiteViewer();
  if (viewer.administrator) return viewer;
  if (!viewer.household) redirect(weddingPath("/login"));
  if (viewer.household.status !== "approved") redirect(weddingPath("/waiting"));
  return viewer;
}
