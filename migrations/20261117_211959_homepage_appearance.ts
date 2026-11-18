import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_wedding_hero_background_mode" AS ENUM('image', 'color');
  ALTER TABLE "wedding" ADD COLUMN "hero_eyebrow" varchar DEFAULT 'Vi gifter oss';
  ALTER TABLE "wedding" ADD COLUMN "hero_title_suffix" varchar DEFAULT 'sitt bryllup';
  ALTER TABLE "wedding" ADD COLUMN "hero_background_mode" "enum_wedding_hero_background_mode" DEFAULT 'color' NOT NULL;
  ALTER TABLE "wedding" ADD COLUMN "hero_image_id" integer;
  ALTER TABLE "wedding" ADD COLUMN "hero_background_color" varchar DEFAULT '#3c4641' NOT NULL;
  ALTER TABLE "wedding" ADD CONSTRAINT "wedding_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "wedding_hero_image_idx" ON "wedding" USING btree ("hero_image_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wedding" DROP CONSTRAINT "wedding_hero_image_id_media_id_fk";

  DROP INDEX "wedding_hero_image_idx";
  ALTER TABLE "wedding" DROP COLUMN "hero_eyebrow";
  ALTER TABLE "wedding" DROP COLUMN "hero_title_suffix";
  ALTER TABLE "wedding" DROP COLUMN "hero_background_mode";
  ALTER TABLE "wedding" DROP COLUMN "hero_image_id";
  ALTER TABLE "wedding" DROP COLUMN "hero_background_color";
  DROP TYPE "public"."enum_wedding_hero_background_mode";`)
}
