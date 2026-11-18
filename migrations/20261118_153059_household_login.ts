import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "household_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_digest" varchar NOT NULL,
  	"household_id" integer,
  	"credential_version" numeric NOT NULL,
  	"session_version" numeric NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "household_login_limits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bucket_digest" varchar NOT NULL,
  	"window_start" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "households" ADD COLUMN "display_name" varchar;
  UPDATE "households" SET "display_name" = "contact_name";
  ALTER TABLE "households" ALTER COLUMN "display_name" SET NOT NULL;
  ALTER TABLE "households" ADD COLUMN "session_version" numeric DEFAULT 1 NOT NULL;
  ALTER TABLE "household_sessions" ADD CONSTRAINT "household_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "household_sessions_token_digest_idx" ON "household_sessions" USING btree ("token_digest");
  CREATE INDEX "household_sessions_household_idx" ON "household_sessions" USING btree ("household_id");
  CREATE INDEX "household_sessions_expires_at_idx" ON "household_sessions" USING btree ("expires_at");
  CREATE INDEX "household_sessions_updated_at_idx" ON "household_sessions" USING btree ("updated_at");
  CREATE INDEX "household_sessions_created_at_idx" ON "household_sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "household_login_limits_bucket_digest_idx" ON "household_login_limits" USING btree ("bucket_digest");
  CREATE INDEX "household_login_limits_window_start_idx" ON "household_login_limits" USING btree ("window_start");
  CREATE INDEX "household_login_limits_updated_at_idx" ON "household_login_limits" USING btree ("updated_at");
  CREATE INDEX "household_login_limits_created_at_idx" ON "household_login_limits" USING btree ("created_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "household_sessions" CASCADE;
  DROP TABLE "household_login_limits" CASCADE;
  ALTER TABLE "households" DROP COLUMN "display_name";
  ALTER TABLE "households" DROP COLUMN "session_version";`)
}
