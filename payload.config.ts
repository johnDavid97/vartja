import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import { Users } from "./collections/Users";
import { Posts } from "./collections/Posts";
import { Media } from "./collections/Media";
import { PollVotes } from "./collections/PollVotes";
import sharp from "sharp";
import { Wedding } from "./globals/Wedding";
import { Program } from "./globals/Program";
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
      providers: ["/components/admin/editor/PostEditorProvider#default"],
      beforeDashboard: ["/components/admin/Welcome#default"],
      graphics: { Logo: "/components/admin/Logo#default" },
    },
  },
  collections: [Users, Posts, Media, PollVotes],
  sharp,
  upload: { limits: { fileSize: 10 * 1024 * 1024 } },
  globals: [Wedding, Program],
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    migrationDir: path.resolve(directory, "migrations"),
  }),
  typescript: { outputFile: path.resolve(directory, "payload-types.ts") },
});
