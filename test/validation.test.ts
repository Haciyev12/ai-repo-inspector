import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runValidation, runValidations } from "../src/validation.js";

const cwd = tmpdir();
const node = (script: string) => `"${process.execPath}" -e ${JSON.stringify(script)}`;

describe("runValidation", () => {
  it("reports a failing command as failed with exit code and stderr, without throwing", async () => {
    const result = await runValidation("echo to-stdout; echo to-stderr >&2; exit 3", cwd);

    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(3);
    expect(result.timedOut).toBe(false);
    expect(result.output).toContain("to-stdout");
    expect(result.output).toContain("to-stderr");
  });

  it("keeps running later commands after one fails", async () => {
    const results = await runValidations(["exit 1", "echo second"], cwd);

    expect(results.map((r) => r.status)).toEqual(["failed", "passed"]);
    expect(results[1].output).toContain("second");
  });

  it("kills a command that exceeds its timeout, including child processes", async () => {
    const started = Date.now();
    // `; echo` stops the shell from exec-ing sleep directly, so sleep is a
    // grandchild that would keep the pipes open if only the shell were killed.
    const result = await runValidation("sleep 5; echo never", cwd, { timeoutMs: 300 });

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.status).toBe("failed");
    expect(result.timedOut).toBe(true);
    expect(result.output).not.toContain("never");
  }, 4_000);

  it("caps output, keeping the start and end with an omission marker", async () => {
    const total = 5 + 100_000 + 3;
    const result = await runValidation(
      node("process.stdout.write('START' + 'x'.repeat(100000) + 'END')"),
      cwd,
      { maxOutputBytes: 1_000 },
    );

    expect(result.status).toBe("passed");
    expect(result.output.startsWith("START")).toBe(true);
    expect(result.output.endsWith("END")).toBe(true);
    expect(result.output).toContain(`[… ${total - 1_000} bytes omitted]`);
    expect(result.output.length).toBeLessThan(1_100);
  });

  it("enforces a total time budget across commands and does not start commands once it is spent", async () => {
    const started = Date.now();
    const results = await runValidations(["sleep 5; echo a", "echo b"], cwd, { totalTimeoutMs: 300 });

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(results.map((r) => [r.status, r.timedOut])).toEqual([
      ["failed", true],
      ["failed", true],
    ]);
    expect(results[1].exitCode).toBeNull();
    expect(results[1].output).toMatch(/not run/i);
    expect(results[1].output).not.toContain("b\n");
  }, 4_000);

  it("does not crash on output beyond 1 MB with default options", async () => {
    const result = await runValidation(node("process.stdout.write('y'.repeat(2_000_000))"), cwd);

    expect(result.status).toBe("passed");
    expect(result.output).toMatch(/\[… \d+ bytes omitted\]/);
  });
});
