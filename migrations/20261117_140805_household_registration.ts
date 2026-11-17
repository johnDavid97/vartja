import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_households_members_status" AS ENUM('pending', 'approved');
  CREATE TYPE "public"."enum_households_status" AS ENUM('pending', 'approved', 'revoked');
  CREATE TYPE "public"."enum_household_credential_audits_action" AS ENUM('reveal', 'rotate');
  CREATE TABLE "households_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"member_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"status" "enum_households_members_status" DEFAULT 'pending' NOT NULL
  );
  
  CREATE TABLE "households" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact_name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"status" "enum_households_status" DEFAULT 'pending' NOT NULL,
  	"revision" numeric DEFAULT 0 NOT NULL,
  	"credential_version" numeric DEFAULT 1 NOT NULL,
  	"public_id" varchar NOT NULL,
  	"access_code_digest" varchar NOT NULL,
  	"access_code_encrypted" varchar NOT NULL,
  	"registration_request_digest" varchar NOT NULL,
  	"registration_request_fingerprint" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "household_credential_audits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"household" numeric NOT NULL,
  	"administrator" numeric NOT NULL,
  	"action" "enum_household_credential_audits_action" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "household_registration_limits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"window_key" varchar NOT NULL,
  	"window_start" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "households_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "household_credential_audits_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "household_registration_limits_id" integer;
  ALTER TABLE "households_members" ADD CONSTRAINT "households_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "households_members_order_idx" ON "households_members" USING btree ("_order");
  CREATE INDEX "households_members_parent_id_idx" ON "households_members" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "households_public_id_idx" ON "households" USING btree ("public_id");
  CREATE UNIQUE INDEX "households_access_code_digest_idx" ON "households" USING btree ("access_code_digest");
  CREATE UNIQUE INDEX "households_registration_request_digest_idx" ON "households" USING btree ("registration_request_digest");
  CREATE INDEX "households_updated_at_idx" ON "households" USING btree ("updated_at");
  CREATE INDEX "households_created_at_idx" ON "households" USING btree ("created_at");
  CREATE INDEX "household_credential_audits_household_idx" ON "household_credential_audits" USING btree ("household");
  CREATE INDEX "household_credential_audits_administrator_idx" ON "household_credential_audits" USING btree ("administrator");
  CREATE INDEX "household_credential_audits_occurred_at_idx" ON "household_credential_audits" USING btree ("occurred_at");
  CREATE INDEX "household_credential_audits_updated_at_idx" ON "household_credential_audits" USING btree ("updated_at");
  CREATE INDEX "household_credential_audits_created_at_idx" ON "household_credential_audits" USING btree ("created_at");
  CREATE UNIQUE INDEX "household_registration_limits_window_key_idx" ON "household_registration_limits" USING btree ("window_key");
  CREATE INDEX "household_registration_limits_window_start_idx" ON "household_registration_limits" USING btree ("window_start");
  CREATE INDEX "household_registration_limits_updated_at_idx" ON "household_registration_limits" USING btree ("updated_at");
  CREATE INDEX "household_registration_limits_created_at_idx" ON "household_registration_limits" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_households_fk" FOREIGN KEY ("households_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_household_credential_audits_fk" FOREIGN KEY ("household_credential_audits_id") REFERENCES "public"."household_credential_audits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_household_registration_limi_fk" FOREIGN KEY ("household_registration_limits_id") REFERENCES "public"."household_registration_limits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_households_id_idx" ON "payload_locked_documents_rels" USING btree ("households_id");
  CREATE INDEX "payload_locked_documents_rels_household_credential_audit_idx" ON "payload_locked_documents_rels" USING btree ("household_credential_audits_id");
  CREATE INDEX "payload_locked_documents_rels_household_registration_lim_idx" ON "payload_locked_documents_rels" USING btree ("household_registration_limits_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "households_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "households" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "household_credential_audits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "household_registration_limits" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "households_members" CASCADE;
  DROP TABLE "households" CASCADE;
  DROP TABLE "household_credential_audits" CASCADE;
  DROP TABLE "household_registration_limits" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_households_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_household_credential_audits_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_household_registration_limi_fk";
  
  DROP INDEX "payload_locked_documents_rels_households_id_idx";
  DROP INDEX "payload_locked_documents_rels_household_credential_audit_idx";
  DROP INDEX "payload_locked_documents_rels_household_registration_lim_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "households_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "household_credential_audits_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "household_registration_limits_id";
  DROP TYPE "public"."enum_households_members_status";
  DROP TYPE "public"."enum_households_status";
  DROP TYPE "public"."enum_household_credential_audits_action";`)
}
