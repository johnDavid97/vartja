import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import { Users } from "./collections/Users";
import { Posts } from "./collections/Posts";
import { Media } from "./collections/Media";
import { PollVotes } from "./collections/PollVotes";
import { Households } from "./collections/Households";
import { HouseholdCredentialAudits } from "./collections/HouseholdCredentialAudits";
import { HouseholdRegistrationLimits } from "./collections/HouseholdRegistrationLimits";
import { HouseholdSessions } from "./collections/HouseholdSessions";
import { HouseholdLoginLimits } from "./collections/HouseholdLoginLimits";
import sharp from "sharp";
import { Wedding } from "./globals/Wedding";
import { Program } from "./globals/Program";
import { ProgramPollVotes } from "./collections/ProgramPollVotes";
import { ProgramComments } from "./collections/ProgramComments";
import { ProgramActivityLimits } from "./collections/ProgramActivityLimits";
import { nb } from "@payloadcms/translations/languages/nb";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  i18n: { supportedLanguages: { nb }, fallbackLanguage: "nb" },
  admin: {
    theme: "light",
    dateFormat: "dd.MM.yyyy HH:mm",
    user: Users.slug,
    importMap: { baseDir: directory },
    meta: { titleSuffix: "— Andrea & Martin" },
    components: {
      Nav: "/components/admin/AdminNav#default",
      views: { polls: { Component: "/components/admin/polls/PollOverviewView#default", path: "/polls", exact: true, meta: { title: "Avstemninger" } } },
      providers: [
        "/components/admin/editor/PostEditorProvider#default",
        "/components/admin/households/HouseholdSummaryProvider#default",
      ],
      beforeDashboard: ["/components/admin/Welcome#default"],
      graphics: { Logo: "/components/admin/Logo#default" },
    },
  },
  collections: [Users, Posts, Media, PollVotes, Households, HouseholdCredentialAudits, HouseholdRegistrationLimits, HouseholdSessions, HouseholdLoginLimits, ProgramPollVotes, ProgramComments, ProgramActivityLimits],
  sharp,
  upload: { limits: { fileSize: 10 * 1024 * 1024 } },
  globals: [Wedding, Program],
  editor: lexicalEditor(),
  db: postgresAdapter({
    // Schema changes are applied explicitly through reviewed migrations, including in development.
    push: false,
    pool: { connectionString: process.env.DATABASE_URL },
    migrationDir: path.resolve(directory, "migrations"),
  }),
  typescript: { outputFile: path.resolve(directory, "payload-types.ts") },
});
