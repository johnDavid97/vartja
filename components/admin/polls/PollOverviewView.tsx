import { DefaultTemplate } from "@payloadcms/next/templates";
import { redirect } from "next/navigation";
import type { AdminViewServerProps } from "payload";
import { LoadPollOverview } from "@/features/polls/overview";
import { PayloadPollOverviewRepository } from "@/features/polls/PayloadPollOverviewRepository";
import PollOverview from "./PollOverview";

export default async function PollOverviewView(props: AdminViewServerProps) {
  const { req, permissions, visibleEntities } = props.initPageResult;
  // Payload custom views do not automatically require authentication.
  if (req.user?.collection !== "users" || !permissions.canAccessAdmin) redirect("/admin/login");
  const rows = await new LoadPollOverview(new PayloadPollOverviewRepository(req)).execute();
  return (
    <DefaultTemplate {...props} req={req} permissions={permissions} visibleEntities={{ collections: visibleEntities.collections, globals: visibleEntities.globals }}>
      <PollOverview rows={rows} />
    </DefaultTemplate>
  );
}
