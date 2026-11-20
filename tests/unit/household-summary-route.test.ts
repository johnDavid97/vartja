import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  getPayload: vi.fn(),
  requireAdministrator: vi.fn(),
  summary: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/features/households/composition-root", () => ({
  getHouseholdSummaryServices: () => ({ get: mocks.summary }),
}));
vi.mock("@/features/households/http/administrator", () => ({
  requireHouseholdAdministrator: mocks.requireAdministrator,
}));

import { GET } from "../../app/(access)/api/household-summary/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPayload.mockResolvedValue({});
  mocks.requireAdministrator.mockResolvedValue(1);
  mocks.summary.mockResolvedValue({ total: 0 });
});

describe("request-only administrator summary", () => {
  it("does not initialize the database until an incoming request is available", async () => {
    let connected!: () => void;
    mocks.connection.mockReturnValue(new Promise<void>((resolve) => { connected = resolve; }));
    const response = GET(new Request("http://localhost/api/household-summary"));
    expect(mocks.getPayload).not.toHaveBeenCalled();
    connected();
    expect((await response).status).toBe(200);
    expect(mocks.requireAdministrator).toHaveBeenCalledOnce();
    expect(mocks.summary).toHaveBeenCalledOnce();
  });

  it("propagates the request-boundary signal before database or authentication work", async () => {
    const signal = new Error("Synthetic request boundary");
    mocks.connection.mockRejectedValue(signal);
    await expect(GET(new Request("http://localhost/api/household-summary"))).rejects.toBe(signal);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.requireAdministrator).not.toHaveBeenCalled();
    expect(mocks.summary).not.toHaveBeenCalled();
  });
});
