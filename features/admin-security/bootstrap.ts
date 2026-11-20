import { sql } from "@payloadcms/db-postgres";
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Endpoint,
  type Payload,
  type PayloadRequest,
} from "payload";

const BOOTSTRAP_LOCK_KEY = 1_397_968_145;

export type AdministratorBootstrapInput = {
  name: string;
  email: string;
  password: string;
};

export class BootstrapAlreadyInitializedError extends Error {
  constructor() {
    super("Administrator bootstrap has already been completed.");
    this.name = "BootstrapAlreadyInitializedError";
  }
}

/** Permanently shadows Payload's subsequently appended native first-register endpoint. */
export const privateFirstRegisterEndpoint: Endpoint = {
  path: "/first-register",
  method: "post",
  handler: () => Response.json(
    { message: "Registrering er ikke tilgjengelig." },
    {
      status: 403,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  ),
};

type TransactionDatabase = {
  execute: (query: unknown) => Promise<unknown>;
};

function getTransactionDatabase(payload: Payload, req: PayloadRequest): TransactionDatabase {
  const transactionID = req.transactionID;
  if (!transactionID || transactionID instanceof Promise) {
    throw new Error("Administrator bootstrap requires an active PostgreSQL transaction.");
  }

  const database = payload.db.sessions?.[String(transactionID)]?.db as TransactionDatabase | undefined;
  if (!database?.execute) {
    throw new Error("Administrator bootstrap requires the PostgreSQL transaction database.");
  }
  return database;
}

/**
 * Creates the sole initial administrator through Payload's normal validation and hashing pipeline.
 * The transaction-scoped PostgreSQL lock makes the empty check and create atomic across processes.
 */
export function bootstrapAdministrator(
  payload: Payload,
  input: AdministratorBootstrapInput,
): Promise<{ id: number }>;
export function bootstrapAdministrator(
  payload: Payload,
  input: Record<string, string>,
): Promise<{ id: number }>;
export async function bootstrapAdministrator(
  payload: Payload,
  input: AdministratorBootstrapInput | Record<string, string>,
): Promise<{ id: number }> {
  const administrator: AdministratorBootstrapInput = {
    name: input.name,
    email: input.email,
    password: input.password,
  };
  const req = await createLocalReq({}, payload);
  const ownsTransaction = await initTransaction(req);

  if (!ownsTransaction) {
    throw new Error("Administrator bootstrap could not start a database transaction.");
  }

  try {
    const transaction = getTransactionDatabase(payload, req);
    // A waiter must see the preceding bootstrap's committed row after acquiring the lock,
    // even if the database's default isolation level was changed to repeatable read.
    await transaction.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`);
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`);

    const { totalDocs } = await payload.count({
      collection: "users",
      overrideAccess: true,
      req,
    });
    if (totalDocs !== 0) throw new BootstrapAlreadyInitializedError();

    const user = await payload.create({
      collection: "users",
      data: administrator,
      overrideAccess: true,
      req,
    });
    if (typeof user.id !== "number") {
      throw new Error("Administrator bootstrap received an invalid user identifier.");
    }

    await commitTransaction(req);
    // Payload 3.94's adapter can swallow a COMMIT rejection. Confirm visibility outside
    // that transaction, with a new request (not a cached findByID), before claiming success.
    const committed = await payload.find({
      collection: "users",
      where: { id: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (committed.docs.length !== 1 || committed.docs[0].id !== user.id) {
      throw new Error("Could not confirm administrator bootstrap commit.");
    }
    return { id: user.id };
  } catch (error) {
    // Payload create may already have rolled back and removed transactionID. killTransaction
    // deliberately tolerates that case and never turns rollback cleanup into a second failure.
    await killTransaction(req);
    throw error;
  }
}
