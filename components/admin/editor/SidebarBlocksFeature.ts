import { createServerFeature } from "@payloadcms/richtext-lexical";

export const SidebarBlocksFeature = createServerFeature({
  key: "sidebarBlocks",
  feature: {
    ClientFeature: "/components/admin/editor/SidebarBlocksFeature.client#SidebarBlocksFeatureClient",
  },
});
