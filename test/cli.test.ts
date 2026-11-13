import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeFixtureRepo } from "./fixtures.js";

const projectRoot = resolve(import.meta.dirname, "..");

function runCli(cwd: string, args: string[]) {
  return spawnSync(join(projectRoot, "node_modules", ".bin", "tsx"), [join(projectRoot, "src", "cli.ts"), ...args], {
    cwd,
    encoding: "utf8",
  });
}

describe("CLI review exit code", () => {
  let repo: string;
  let outDir: string;

  beforeEach(() => {
    repo = makeFixtureRepo();
    outDir = mkdtempSync(join(tmpdir(), "inspector-cli-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  });

  it("writes a report marking the failure and exits non-zero when a validation fails", () => {
    const result = runCli(outDir, ["review", "--repo", repo, "--validate", "echo boom; exit 2"]);

    expect(result.status).toBe(1);
    const report = readFileSync(join(outDir, "review-report.md"), "utf8");
    expect(report).toContain("boom");
    expect(report).toMatch(/echo boom; exit 2.*failed/);
  }, 20_000);

  it("exits zero when all validations pass", () => {
    const result = runCli(outDir, ["review", "--repo", repo, "--validate", "echo fine"]);

    expect(result.status).toBe(0);
    expect(readFileSync(join(outDir, "review-report.md"), "utf8")).toMatch(/echo fine.*passed/);
  }, 20_000);
});
