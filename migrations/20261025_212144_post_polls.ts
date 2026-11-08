import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "poll_votes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"post_id" integer NOT NULL,
  	"poll_id" varchar NOT NULL,
  	"option_id" varchar NOT NULL,
  	"definition" jsonb NOT NULL,
  	"vote_key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "poll_votes_id" integer;
  ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "poll_votes_post_idx" ON "poll_votes" USING btree ("post_id");
  CREATE INDEX "poll_votes_poll_id_idx" ON "poll_votes" USING btree ("poll_id");
  CREATE UNIQUE INDEX "poll_votes_vote_key_idx" ON "poll_votes" USING btree ("vote_key");
  CREATE INDEX "poll_votes_updated_at_idx" ON "poll_votes" USING btree ("updated_at");
  CREATE INDEX "poll_votes_created_at_idx" ON "poll_votes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_poll_votes_fk" FOREIGN KEY ("poll_votes_id") REFERENCES "public"."poll_votes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_poll_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("poll_votes_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "poll_votes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "poll_votes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_poll_votes_fk";
  
  DROP INDEX "payload_locked_documents_rels_poll_votes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "poll_votes_id";`)
}
