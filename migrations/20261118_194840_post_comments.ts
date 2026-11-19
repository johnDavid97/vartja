import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_program_comments_source" AS ENUM('program-day', 'post');
  ALTER TABLE "program_comments" ALTER COLUMN "day_id" DROP NOT NULL;
  ALTER TABLE "posts" ADD COLUMN "comments_enabled" boolean DEFAULT true;
  ALTER TABLE "_posts_v" ADD COLUMN "version_comments_enabled" boolean DEFAULT true;
  ALTER TABLE "program_comments" ADD COLUMN "source" "enum_program_comments_source" DEFAULT 'program-day' NOT NULL;
  ALTER TABLE "program_comments" ADD COLUMN "post_id" numeric;
  CREATE INDEX "program_comments_post_id_idx" ON "program_comments" USING btree ("post_id");
  ALTER TABLE "program_comments" ADD CONSTRAINT "program_comments_single_target" CHECK (
    ("source" = 'program-day' AND "day_id" IS NOT NULL AND "post_id" IS NULL)
    OR ("source" = 'post' AND "day_id" IS NULL AND "post_id" IS NOT NULL AND "post_id" BETWEEN 1 AND 2147483647 AND "post_id" = trunc("post_id"))
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "program_comments" WHERE "source" = 'post') THEN
      RAISE EXCEPTION 'Cannot roll back post comments while post comment records exist. Export and migrate them explicitly first.';
    END IF;
   END $$;
  ALTER TABLE "program_comments" DROP CONSTRAINT "program_comments_single_target";
  DROP INDEX "program_comments_post_id_idx";
  ALTER TABLE "program_comments" ALTER COLUMN "day_id" SET NOT NULL;
  ALTER TABLE "posts" DROP COLUMN "comments_enabled";
  ALTER TABLE "_posts_v" DROP COLUMN "version_comments_enabled";
  ALTER TABLE "program_comments" DROP COLUMN "source";
  ALTER TABLE "program_comments" DROP COLUMN "post_id";
  DROP TYPE "public"."enum_program_comments_source";`)
}
