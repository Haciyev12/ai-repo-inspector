import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { makeFixtureRepo } from "./fixtures.js";

const projectRoot = resolve(import.meta.dirname, "..");
const ALLOWLIST_ENV = "INSPECTOR_MCP_ALLOWED_VALIDATIONS";

type TextResult = { isError?: boolean; content: Array<{ type: string; text: string }> };

/**
 * Starts the real stdio server. Its cwd is the inspector project itself, so a
 * server that ignores repo_path would inspect the wrong repository.
 * `getDefaultEnvironment()` (not process.env) keeps a developer's own
 * allowlist variable from leaking into the "default" tests.
 */
async function startServer(extraEnv: Record<string, string> = {}): Promise<Client> {
  const transport = new StdioClientTransport({
    command: join(projectRoot, "node_modules", ".bin", "tsx"),
    args: [join(projectRoot, "src", "mcp-server.ts")],
    cwd: projectRoot,
    env: { ...getDefaultEnvironment(), ...extraEnv },
    stderr: "ignore",
  });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

async function review(client: Client, args: Record<string, unknown>): Promise<TextResult> {
  return (await client.callTool({ name: "review_repository", arguments: args })) as TextResult;
}

describe("MCP review_repository", () => {
  let repo: string;
  let client: Client;

  beforeAll(async () => {
    repo = makeFixtureRepo();
    client = await startServer();
  }, 20_000);

  afterAll(async () => {
    await client?.close();
    rmSync(repo, { recursive: true, force: true });
  });

  it("inspects the repository given in repo_path", async () => {
    const result = await review(client, { repo_path: repo, baseRef: "main" });

    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain(`# Review Report: ${repo}`);
    expect(text).toContain("- added.txt (added)");
  }, 20_000);

  describe("validation commands with no allowlist configured", () => {
    // The manual reproduction: an MCP caller asks the server to run a shell
    // command that writes a file. With no allowlist, nothing may run.
    const pocFile = "/tmp/mcp-poc.txt";
    const pocCommand = `echo "pwned by MCP as $(whoami) at $(date)" > ${pocFile}`;

    afterEach(() => rmSync(pocFile, { force: true }));

    it("refuses to run them and executes nothing", async () => {
      rmSync(pocFile, { force: true });

      const result = await review(client, { repo_path: repo, validationCommands: [pocCommand] });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not allowed/i);
      expect(existsSync(pocFile)).toBe(false);
    }, 20_000);
  });

  describe(`validation commands with ${ALLOWLIST_ENV} set`, () => {
    let allowClient: Client;
    let marker: string;

    beforeAll(async () => {
      marker = join(repo, "near-miss-ran");
      allowClient = await startServer({ [ALLOWLIST_ENV]: JSON.stringify(["echo allowed-ok"]) });
    }, 20_000);

    afterAll(async () => {
      await allowClient?.close();
    });

    it("runs a command that exactly matches an allowlist entry", async () => {
      const result = await review(allowClient, {
        repo_path: repo,
        baseRef: "main",
        validationCommands: ["echo allowed-ok"],
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain("allowed-ok");
    }, 20_000);

    it("rejects near-misses of an allowlisted command, running none of the batch", async () => {
      const result = await review(allowClient, {
        repo_path: repo,
        baseRef: "main",
        validationCommands: ["echo allowed-ok", `echo allowed-ok; touch ${marker}`],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(`echo allowed-ok; touch ${marker}`);
      expect(existsSync(marker)).toBe(false);
    }, 20_000);
  });
});
