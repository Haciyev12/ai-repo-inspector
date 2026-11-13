import { rmSync } from "node:fs";
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";
import { DEFAULT_TIMEOUT_MS } from "../src/validation.js";
import { MCP_VALIDATION_OPTIONS } from "../src/validation-policy.js";
import { makeFixtureRepo } from "./fixtures.js";

describe("per-interface validation timeouts", () => {
  it("CLI default stays at 120 s per command", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(120_000);
  });

  it("MCP answers before the SDK client's default request timeout gives up", () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MSEC).toBe(60_000);
    expect(MCP_VALIDATION_OPTIONS.totalTimeoutMs).toBe(50_000);
    expect(MCP_VALIDATION_OPTIONS.timeoutMs).toBeLessThanOrEqual(MCP_VALIDATION_OPTIONS.totalTimeoutMs!);
    // Leave headroom for git, report rendering and transport.
    expect(DEFAULT_REQUEST_TIMEOUT_MSEC - MCP_VALIDATION_OPTIONS.totalTimeoutMs!).toBeGreaterThanOrEqual(5_000);
  });
});

describe("reviewRepository validation options", () => {
  let repo: string;

  beforeEach(() => {
    repo = makeFixtureRepo();
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("passes the interface's timeout through to validations", async () => {
    const started = Date.now();
    const result = await reviewRepository({
      repositoryPath: repo,
      baseRef: "main",
      validationCommands: ["sleep 5; echo x"],
      validationOptions: { timeoutMs: 300 },
    });

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.validationResults[0].timedOut).toBe(true);
  }, 4_000);
});
