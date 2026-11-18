import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

interface RunSubprocessOptions {
  spawn?: SpawnOptions;
  timeoutMs: number;
  terminationGraceMs?: number;
}

const DEFAULT_TERMINATION_GRACE_MS = 10_000;

function isRunning(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

/** Ask a process to stop, escalating if it has not exited within the grace period. */
export async function terminateSubprocess(
  child: ChildProcess,
  graceMs = DEFAULT_TERMINATION_GRACE_MS,
): Promise<void> {
  if (!isRunning(child) || child.pid === undefined) return;

  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(escalationTimer);
      child.removeListener("exit", finish);
      child.removeListener("error", handleSpawnError);
      resolve();
    };
    const handleSpawnError = () => {
      // A process which failed to spawn has no exit event to await.
      if (child.pid === undefined) finish();
    };

    child.once("exit", finish);
    child.once("error", handleSpawnError);
    const escalationTimer = setTimeout(() => {
      if (isRunning(child)) child.kill("SIGKILL");
    }, graceMs);
    child.kill("SIGTERM");
  });
}

/** Run a subprocess and do not settle a timeout until that process has exited. */
export async function runSubprocess(
  command: string,
  arguments_: string[],
  options: RunSubprocessOptions,
): Promise<void> {
  const child: ChildProcess = spawn(command, arguments_, { stdio: "inherit", ...options.spawn });
  const graceMs = options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      void terminateSubprocess(child, graceMs);
    }, options.timeoutMs);

    const finish = (result: "resolve" | "reject", error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener("error", handleError);
      child.removeListener("exit", handleExit);
      if (result === "resolve") resolve();
      else reject(error);
    };
    const handleError = (error: Error) => {
      // Failed spawns never emit exit. A kill error after timeout must not let
      // cleanup continue while the process may still be alive.
      if (!timedOut || child.pid === undefined) finish("reject", error);
    };
    const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (timedOut) {
        finish("reject", new Error(`Subprocess timed out after ${options.timeoutMs}ms`));
      } else if (code === 0) {
        finish("resolve");
      } else if (signal) {
        finish("reject", new Error(`Subprocess exited with signal ${signal}`));
      } else {
        finish("reject", new Error(`Subprocess exited with status ${code}`));
      }
    };

    child.once("error", handleError);
    child.once("exit", handleExit);
  });
}
