import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_visibility" AS ENUM('public', 'private');
  CREATE TYPE "public"."enum__posts_v_version_visibility" AS ENUM('public', 'private');
  ALTER TABLE "posts" ADD COLUMN "visibility" "enum_posts_visibility" DEFAULT 'public';
  ALTER TABLE "_posts_v" ADD COLUMN "version_visibility" "enum__posts_v_version_visibility" DEFAULT 'public';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP COLUMN "visibility";
  ALTER TABLE "_posts_v" DROP COLUMN "version_visibility";
  DROP TYPE "public"."enum_posts_visibility";
  DROP TYPE "public"."enum__posts_v_version_visibility";`)
}
