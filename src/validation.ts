import { spawn } from "node:child_process";
import type { ValidationResult } from "./types.js";

export type ValidationOptions = {
  /** Kill the command (and its children) after this long. */
  timeoutMs?: number;
  /** Max bytes of combined stdout+stderr kept; the middle is dropped beyond this. */
  maxOutputBytes?: number;
  /**
   * Budget for all commands together (runValidations only). Each command gets
   * min(timeoutMs, time left); once it is spent, remaining commands are not
   * started and are reported as failed + timedOut.
   */
  totalTimeoutMs?: number;
};

export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 16_384;

/** Keeps the first and last `maxBytes / 2` bytes of a stream and counts the rest. */
class HeadTailBuffer {
  private head = Buffer.alloc(0);
  private tail = Buffer.alloc(0);
  private total = 0;
  private readonly headCap: number;
  private readonly tailCap: number;

  constructor(maxBytes: number) {
    this.headCap = Math.ceil(maxBytes / 2);
    this.tailCap = Math.floor(maxBytes / 2);
  }

  push(chunk: Buffer) {
    this.total += chunk.length;
    const toHead = Math.min(this.headCap - this.head.length, chunk.length);
    if (toHead > 0) {
      this.head = Buffer.concat([this.head, chunk.subarray(0, toHead)]);
    }
    const rest = chunk.subarray(toHead);
    if (rest.length > 0) {
      const tail = Buffer.concat([this.tail, rest]);
      this.tail = tail.subarray(Math.max(0, tail.length - this.tailCap));
    }
  }

  toString(): string {
    const omitted = this.total - this.head.length - this.tail.length;
    if (omitted === 0) {
      return Buffer.concat([this.head, this.tail]).toString("utf8");
    }
    return `${this.head.toString("utf8")}\n[… ${omitted} bytes omitted]\n${this.tail.toString("utf8")}`;
  }
}

/** Runs one shell command. Never rejects: failures and timeouts are results. */
export function runValidation(command: string, cwd: string, options: ValidationOptions = {}): Promise<ValidationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const output = new HeadTailBuffer(options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES);

  return new Promise((resolve) => {
    // detached: own process group, so a timeout can kill the shell's children too.
    const child = spawn(command, { cwd, shell: true, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let timedOut = false;
    let settled = false;

    const finish = (exitCode: number | null, extra?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (extra) output.push(Buffer.from(extra));
      const passed = exitCode === 0 && !timedOut;
      resolve({ command, status: passed ? "passed" : "failed", exitCode, timedOut, output: output.toString() });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => output.push(chunk));
    child.on("error", (error) => finish(null, `\n[failed to start: ${error.message}]`));
    child.on("close", (code) => finish(code, timedOut ? `\n[timed out after ${timeoutMs} ms]` : undefined));
  });
}

export async function runValidations(
  commands: string[],
  cwd: string,
  options: ValidationOptions = {},
): Promise<ValidationResult[]> {
  const { totalTimeoutMs, ...perCommand } = options;
  const deadline = totalTimeoutMs === undefined ? Infinity : Date.now() + totalTimeoutMs;
  const perCommandTimeout = perCommand.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const results: ValidationResult[] = [];
  for (const command of commands) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      results.push({
        command,
        status: "failed",
        exitCode: null,
        timedOut: true,
        output: `[not run: total validation budget of ${totalTimeoutMs} ms was spent]`,
      });
      continue;
    }
    results.push(await runValidation(command, cwd, { ...perCommand, timeoutMs: Math.min(perCommandTimeout, remaining) }));
  }
  return results;
}
