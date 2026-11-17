import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_program_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__program_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "program" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"itinerary" jsonb DEFAULT '{"days":[]}'::jsonb,
  	"_status" "enum_program_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE "_program_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_itinerary" jsonb DEFAULT '{"days":[]}'::jsonb,
  	"version__status" "enum__program_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );

  CREATE INDEX "program__status_idx" ON "program" USING btree ("_status");
  CREATE INDEX "_program_v_version_version__status_idx" ON "_program_v" USING btree ("version__status");
  CREATE INDEX "_program_v_created_at_idx" ON "_program_v" USING btree ("created_at");
  CREATE INDEX "_program_v_updated_at_idx" ON "_program_v" USING btree ("updated_at");
  CREATE INDEX "_program_v_latest_idx" ON "_program_v" USING btree ("latest");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "program" CASCADE;
  DROP TABLE "_program_v" CASCADE;
  DROP TYPE "public"."enum_program_status";
  DROP TYPE "public"."enum__program_v_version_status";`)
}
