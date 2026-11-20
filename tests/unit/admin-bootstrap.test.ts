import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Payload, PayloadRequest } from "payload";

import payloadConfig from "../../payload.config";
import {
  bootstrapAdministrator,
  BootstrapAlreadyInitializedError,
  privateFirstRegisterEndpoint,
} from "../../features/admin-security/bootstrap";

type FakePayloadOptions = { existingUsers?: number; createdID?: number; commitVisible?: boolean };

async function fakePayload(options: FakePayloadOptions = {}) {
  const config = await payloadConfig;
  const execute = vi.fn().mockResolvedValue(undefined);
  const commitTransaction = vi.fn(async (id: number | string | Promise<number | string>) => {
    delete sessions[String(await id)];
  });
  const rollbackTransaction = vi.fn(async (id: number | string | Promise<number | string>) => {
    delete sessions[String(await id)];
  });
  const sessions: NonNullable<Payload["db"]["sessions"]> = {};
  const beginTransaction = vi.fn(async () => {
    sessions.bootstrap = {
      db: { execute },
      reject: async () => undefined,
      resolve: async () => undefined,
    };
    return "bootstrap";
  });
  let operationReq: Partial<PayloadRequest> | undefined;
  const count = vi.fn(async ({ req }: { req?: Partial<PayloadRequest> }) => {
    operationReq = req;
    return { totalDocs: options.existingUsers ?? 0 };
  });
  const create = vi.fn(async ({ req }: { req?: Partial<PayloadRequest> }) => {
    expect(req).toBe(operationReq);
    expect(req?.transactionID).toBe("bootstrap");
    return { id: options.createdID ?? 42 };
  });

  const find = vi.fn(async () => ({ docs: options.commitVisible === false ? [] : [{ id: options.createdID ?? 42 }] }));
  const payload = {
    config,
    db: { beginTransaction, commitTransaction, rollbackTransaction, sessions },
    count,
    create,
    find,
  } as unknown as Payload;
  return { payload, execute, beginTransaction, commitTransaction, rollbackTransaction, count, create, find };
}

describe("private administrator bootstrap", () => {
  it("uses one shared Payload request and transaction for lock, count and native create", async () => {
    const mocked = await fakePayload();

    await expect(bootstrapAdministrator(mocked.payload, {
      name: "Privat administrator",
      email: "admin@example.test",
      password: "a-secure-password-of-15",
    })).resolves.toEqual({ id: 42 });

    expect(mocked.beginTransaction).toHaveBeenCalledOnce();
    expect(mocked.execute).toHaveBeenCalledTimes(2);
    const statements = mocked.execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query).sql);
    expect(statements[0]).toBe("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    expect(statements[1]).toContain("pg_advisory_xact_lock");
    expect(mocked.count).toHaveBeenCalledWith(expect.objectContaining({ collection: "users", overrideAccess: true }));
    expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ collection: "users", overrideAccess: true }));
    expect(mocked.commitTransaction).toHaveBeenCalledWith("bootstrap");
    expect(mocked.rollbackTransaction).not.toHaveBeenCalled();
    expect(mocked.find).toHaveBeenCalledWith({
      collection: "users", where: { id: { equals: 42 } }, limit: 1, depth: 0, overrideAccess: true,
    });
  });

  it("does not claim success when the adapter silently loses a failed commit", async () => {
    const mocked = await fakePayload({ commitVisible: false });
    await expect(bootstrapAdministrator(mocked.payload, {
      name: "Administrator", email: "admin@example.test", password: "a-secure-password-of-15",
    })).rejects.toThrow("Could not confirm administrator bootstrap commit.");
    expect(mocked.commitTransaction).toHaveBeenCalledOnce();
  });

  it("refuses every non-empty Users collection without updating or resetting it", async () => {
    const mocked = await fakePayload({ existingUsers: 1 });

    await expect(bootstrapAdministrator(mocked.payload, {
      name: "Ignored",
      email: "ignored@example.test",
      password: "ignored-password-value",
    })).rejects.toBeInstanceOf(BootstrapAlreadyInitializedError);

    expect(mocked.create).not.toHaveBeenCalled();
    expect(mocked.rollbackTransaction).toHaveBeenCalledWith("bootstrap");
    expect(mocked.commitTransaction).not.toHaveBeenCalled();
  });

  it("places the permanent denial before Payload's native endpoint", async () => {
    const config = await payloadConfig;
    const users = config.collections.find(({ slug }) => slug === "users");
    const matching = Array.isArray(users?.endpoints)
      ? users.endpoints.filter(({ method, path }) => method === "post" && path === "/first-register")
      : [];

    expect(matching).toHaveLength(2);
    expect(matching[0]).toBe(privateFirstRegisterEndpoint);

    const response = await matching[0]!.handler({} as PayloadRequest);
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ message: "Registrering er ikke tilgjengelig." });
  });
});
