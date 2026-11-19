import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import type { AdminViewServerProps } from "payload";
import { getHouseholdSummaryServices } from "@/features/households/composition-root";
import { publishedGuestPosts } from "@/features/households/auth/access";
import WelcomeView, { type DashboardSummary } from "./WelcomeView";

/** Payload supplies the surrounding native admin template, navigation and auth hydration. */
export default async function Welcome(props: AdminViewServerProps) {
  const { req, permissions } = props.initPageResult;
  if (req.user?.collection !== "users" || !permissions.canAccessAdmin) redirect("/admin/login");

  let summary: DashboardSummary | null = null;
  try {
    const [households, posts] = await Promise.all([
      getHouseholdSummaryServices(req.payload).get(),
      req.payload.count({ collection: "posts", where: publishedGuestPosts, req, overrideAccess: false }),
    ]);
    summary = {
      totalHouseholds: households.total,
      pendingHouseholds: households.pending,
      visiblePosts: posts.totalDocs,
    };
  } catch {
    // Counts are optional presentation: keep native navigation usable during a database error.
    req.payload.logger.error("Could not load the admin dashboard summary.");
  }

  return <Gutter><WelcomeView summary={summary} /></Gutter>;
}
