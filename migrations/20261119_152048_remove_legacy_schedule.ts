import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** User-approved permanent removal. Back up the database before applying. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // No CASCADE: unexpected external dependencies must stop the migration.
  await db.execute(sql`DROP TABLE "public"."wedding_schedule";`)
}

/** Restores the old schema only; deleted entries require the pre-migration backup. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "public"."wedding_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "time" timestamp(3) with time zone NOT NULL,
      "description" varchar
    );
    ALTER TABLE "public"."wedding_schedule" ADD CONSTRAINT "wedding_schedule_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "wedding_schedule_order_idx" ON "public"."wedding_schedule" USING btree ("_order");
    CREATE INDEX "wedding_schedule_parent_id_idx" ON "public"."wedding_schedule" USING btree ("_parent_id");
  `)
}
