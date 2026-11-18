import type { GlobalConfig } from "payload";
import { programError } from "../lib/program";
import { validateProgramPolls } from "../features/program/activity/validateProgramPolls";

export const Program: GlobalConfig = {
  slug: "program",
  label: "Program",
  admin: { group: "Bryllupet", hideAPIURL: true, components: { elements: { beforeDocumentControls: ["/components/admin/program/ProgramHeading#default"] } } },
  // Anonymous REST/GraphQL access stays closed, including draft/version requests.
  // The website deliberately reads the live record server-side and checks its status.
  access: { read: ({ req }) => req.user?.collection === "users", update: ({ req }) => req.user?.collection === "users", readVersions: () => false },
  // Payload needs internal versions for draft/live separation, but history is not an editor feature.
  // Validate drafts too: incomplete dates/times are allowed, malformed JSON is not.
  versions: { drafts: { validate: true }, max: 20 },
  hooks: { beforeChange: [validateProgramPolls] },
  fields: [{
    name: "itinerary", label: "Program", type: "json", required: true, defaultValue: { days: [] },
    validate: (value, { data }) => programError(value, Boolean(data && "_status" in data && data._status === "published")) ?? true,
    admin: { components: { Field: "/components/admin/program/ProgramBuilder#default" } },
  }],
};
