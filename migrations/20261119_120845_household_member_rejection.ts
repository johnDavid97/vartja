import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Do not silently grant or withdraw access from inconsistent legacy records.
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM households h
        WHERE NOT EXISTS (SELECT 1 FROM households_members m WHERE m._parent_id = h.id)
          OR (h.status = 'pending' AND EXISTS (
            SELECT 1 FROM households_members m WHERE m._parent_id = h.id AND m.status = 'approved'
          ))
          OR (h.status = 'approved' AND NOT EXISTS (
            SELECT 1 FROM households_members m WHERE m._parent_id = h.id AND m.status = 'approved'
          ))
      ) THEN
        RAISE EXCEPTION 'Household approval conflicts with member approvals. Review legacy statuses explicitly before migrating.';
      END IF;
    END $$;

    -- Recreate the enum so the new value can be used within this same transaction.
    ALTER TABLE households_members ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE households_members ALTER COLUMN status TYPE text;
    DROP TYPE public.enum_households_members_status;
    CREATE TYPE public.enum_households_members_status AS ENUM ('pending', 'approved', 'revoked');
    ALTER TABLE households_members ALTER COLUMN status TYPE public.enum_households_members_status
      USING status::public.enum_households_members_status;
    ALTER TABLE households_members ALTER COLUMN status SET DEFAULT 'pending'::public.enum_households_members_status;

    -- Legacy household rejection applied to the whole family. Retain denied access.
    UPDATE households_members m SET status = 'revoked'
      FROM households h WHERE h.id = m._parent_id AND h.status = 'revoked';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM households_members WHERE status = 'revoked') THEN
        RAISE EXCEPTION 'Cannot roll back while rejected members exist. Export and migrate their decisions explicitly first.';
      END IF;
    END $$;
    ALTER TABLE households_members ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE households_members ALTER COLUMN status TYPE text;
    DROP TYPE public.enum_households_members_status;
    CREATE TYPE public.enum_households_members_status AS ENUM ('pending', 'approved');
    ALTER TABLE households_members ALTER COLUMN status TYPE public.enum_households_members_status
      USING status::public.enum_households_members_status;
    ALTER TABLE households_members ALTER COLUMN status SET DEFAULT 'pending'::public.enum_households_members_status;
  `)
}
