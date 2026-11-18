import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from "payload";

/** Shared by native Program saves and guest writes, so publication and ballots cannot race. */
export async function lockProgramActivity(req: PayloadRequest) {
  const id = await req.transactionID;
  const sessions = req.payload.db.sessions as PostgresAdapter["sessions"];
  const database = id ? sessions[id]?.db : undefined;
  if (!database) throw new Error("Program writes require a transaction");
  await database.execute(sql`SELECT pg_advisory_xact_lock(20261119, 1)`);
}

export async function programTransaction<T>(payload: Payload, operation: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  try {
    await lockProgramActivity(req);
    const result = await operation(req);
    await commitTransaction(req);
    return result;
  } catch (error) {
    await killTransaction(req);
    throw error;
  }
}
