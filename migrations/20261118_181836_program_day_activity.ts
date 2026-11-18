import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_program_comments_status" AS ENUM('published', 'hidden');
  CREATE TABLE "program_poll_votes" (
    "id" serial PRIMARY KEY NOT NULL,
    "day_id" varchar NOT NULL,
    "poll_id" varchar NOT NULL,
    "option_id" varchar NOT NULL,
    "definition" jsonb NOT NULL,
    "vote_key" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "program_comments" (
    "id" serial PRIMARY KEY NOT NULL,
    "day_id" varchar NOT NULL,
    "day_label" varchar NOT NULL,
    "author_name" varchar NOT NULL,
    "household_id" integer,
    "administrator_id" integer,
    "parent_id" integer,
    "body" varchar NOT NULL,
    "status" "enum_program_comments_status" DEFAULT 'published' NOT NULL,
    "request_digest" varchar NOT NULL,
    "request_fingerprint" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "program_activity_limits" (
    "id" serial PRIMARY KEY NOT NULL,
    "bucket_digest" varchar NOT NULL,
    "window_start" timestamp(3) with time zone NOT NULL,
    "attempts" numeric NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "program_poll_votes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "program_comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "program_activity_limits_id" integer;
  ALTER TABLE "program_comments" ADD CONSTRAINT "program_comments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "program_comments" ADD CONSTRAINT "program_comments_administrator_id_users_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "program_comments" ADD CONSTRAINT "program_comments_parent_id_program_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."program_comments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "program_poll_votes_day_id_idx" ON "program_poll_votes" USING btree ("day_id");
  CREATE INDEX "program_poll_votes_poll_id_idx" ON "program_poll_votes" USING btree ("poll_id");
  CREATE UNIQUE INDEX "program_poll_votes_vote_key_idx" ON "program_poll_votes" USING btree ("vote_key");
  CREATE INDEX "program_poll_votes_updated_at_idx" ON "program_poll_votes" USING btree ("updated_at");
  CREATE INDEX "program_poll_votes_created_at_idx" ON "program_poll_votes" USING btree ("created_at");
  CREATE INDEX "program_comments_day_id_idx" ON "program_comments" USING btree ("day_id");
  CREATE INDEX "program_comments_household_idx" ON "program_comments" USING btree ("household_id");
  CREATE INDEX "program_comments_administrator_idx" ON "program_comments" USING btree ("administrator_id");
  CREATE INDEX "program_comments_parent_idx" ON "program_comments" USING btree ("parent_id");
  CREATE UNIQUE INDEX "program_comments_request_digest_idx" ON "program_comments" USING btree ("request_digest");
  CREATE INDEX "program_comments_updated_at_idx" ON "program_comments" USING btree ("updated_at");
  CREATE INDEX "program_comments_created_at_idx" ON "program_comments" USING btree ("created_at");
  CREATE UNIQUE INDEX "program_activity_limits_bucket_digest_idx" ON "program_activity_limits" USING btree ("bucket_digest");
  CREATE INDEX "program_activity_limits_window_start_idx" ON "program_activity_limits" USING btree ("window_start");
  CREATE INDEX "program_activity_limits_updated_at_idx" ON "program_activity_limits" USING btree ("updated_at");
  CREATE INDEX "program_activity_limits_created_at_idx" ON "program_activity_limits" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_program_poll_votes_fk" FOREIGN KEY ("program_poll_votes_id") REFERENCES "public"."program_poll_votes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_program_comments_fk" FOREIGN KEY ("program_comments_id") REFERENCES "public"."program_comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_program_activity_limits_fk" FOREIGN KEY ("program_activity_limits_id") REFERENCES "public"."program_activity_limits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_program_poll_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("program_poll_votes_id");
  CREATE INDEX "payload_locked_documents_rels_program_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("program_comments_id");
  CREATE INDEX "payload_locked_documents_rels_program_activity_limits_id_idx" ON "payload_locked_documents_rels" USING btree ("program_activity_limits_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "program_poll_votes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "program_comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "program_activity_limits" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "program_poll_votes" CASCADE;
  DROP TABLE "program_comments" CASCADE;
  DROP TABLE "program_activity_limits" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_program_poll_votes_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_program_comments_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_program_activity_limits_fk";

  DROP INDEX "payload_locked_documents_rels_program_poll_votes_id_idx";
  DROP INDEX "payload_locked_documents_rels_program_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_program_activity_limits_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "program_poll_votes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "program_comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "program_activity_limits_id";
  DROP TYPE "public"."enum_program_comments_status";`)
}
