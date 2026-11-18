import { describe, expect, test } from "vitest";
import { runSubprocess } from "../integration/subprocess";

const PROCESS_TIMEOUT_MS = 1_500;

describe("subprocess lifecycle", () => {
  test("resolves for a successful process", async () => {
    await expect(runNode("process.exit(0)")).resolves.toBeUndefined();
  });

  test("rejects for a nonzero exit", async () => {
    await expect(runNode("process.exit(7)")).rejects.toThrow("exited with status 7");
  });

  test("rejects when the process cannot be spawned", async () => {
    await expect(runSubprocess(
      `/definitely-missing-subprocess-${process.pid}-${Date.now()}`,
      [],
      { timeoutMs: 2_000 },
    )).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("does not settle a timeout until the process finishes handling SIGTERM", async () => {
    const startedAt = Date.now();

    await expect(runNode(
      `process.on("SIGTERM", () => setTimeout(() => process.exit(0), 250));
       setInterval(() => {}, 1_000);`,
      { terminationGraceMs: 2_000 },
    )).rejects.toThrow("timed out");

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(PROCESS_TIMEOUT_MS + 200);
  }, 10_000);

  test("escalates to SIGKILL when a process ignores SIGTERM", async () => {
    const startedAt = Date.now();
    const terminationGraceMs = 300;

    await expect(runNode(
      `process.on("SIGTERM", () => {});
       setInterval(() => {}, 1_000);`,
      { terminationGraceMs },
    )).rejects.toThrow("timed out");

    const elapsedMs = Date.now() - startedAt;
    expect(elapsedMs).toBeGreaterThanOrEqual(PROCESS_TIMEOUT_MS + terminationGraceMs - 50);
    expect(elapsedMs).toBeLessThan(5_000);
  }, 10_000);
});

function runNode(
  source: string,
  options: { terminationGraceMs?: number } = {},
): Promise<void> {
  return runSubprocess(process.execPath, ["--eval", source], {
    spawn: { stdio: "ignore" },
    timeoutMs: PROCESS_TIMEOUT_MS,
    ...options,
  });
}
