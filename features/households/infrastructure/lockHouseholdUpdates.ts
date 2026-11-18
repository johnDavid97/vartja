import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import type { CollectionBeforeOperationHook } from "payload";

/** Serialize native edits with code rotation before Payload reads originalDoc.
 * Otherwise a stale edit could restore an old credential/session version after revocation.
 */
export const lockHouseholdUpdates: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== "update") return args;
  // Ordinary guest CRUD is denied by collection access; do not acquire locks for it.
  if (args.req.user?.collection !== "users" && !("overrideAccess" in args && args.overrideAccess)) return args;
  const transactionId = await args.req.transactionID;
  const sessions = args.req.payload.db.sessions as PostgresAdapter["sessions"] | undefined;
  const transaction = transactionId ? sessions?.[transactionId]?.db : undefined;
  if (!transaction) throw new Error("Household updates require a database transaction");
  if ("id" in args && args.id !== undefined) {
    await transaction.execute(sql`SELECT id FROM households WHERE id = ${args.id} FOR UPDATE`);
  } else {
    // Native bulk updates also need their original records to be read under a lock.
    await transaction.execute(sql`SELECT id FROM households ORDER BY id FOR UPDATE`);
  }
  return args;
};
