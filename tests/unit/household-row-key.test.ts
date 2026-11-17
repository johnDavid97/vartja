import { describe, expect, it } from "vitest";
import { createAvailableMemberRowKey } from "../../components/households/member-row-key";

describe("household member row keys", () => {
  it("creates the first available key for an empty form", () => {
    expect(createAvailableMemberRowKey("family-new", [])).toBe("family-new-0");
  });

  it("does not duplicate keys preserved by the parent after a remount", () => {
    const restoredRowKeys = ["family-new-0", "family-new-1", "existing-member"];
    expect(createAvailableMemberRowKey("family-new", restoredRowKeys)).toBe("family-new-2");
    expect(restoredRowKeys).toEqual(["family-new-0", "family-new-1", "existing-member"]);
  });

  it("can reuse a removed row's key without colliding with remaining rows", () => {
    expect(createAvailableMemberRowKey("family-new", ["family-new-0", "family-new-2"])).toBe("family-new-1");
  });
});
