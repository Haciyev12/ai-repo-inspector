import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function git(cwd: string, ...args: string[]) {
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
    cwd,
    stdio: "ignore",
  });
}

/** Temp repo: `main` with one commit, `feature` adds `added.txt`. */
function makeFixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "inspector-mcp-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "base.txt"), "base\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "base");
  git(dir, "checkout", "-q", "-b", "feature");
  writeFileSync(join(dir, "added.txt"), "new\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "feature");
  return dir;
}

describe("MCP review_repository", () => {
  let repo: string;
  let client: Client;

  beforeAll(async () => {
    repo = makeFixtureRepo();
    // Server cwd is the inspector project itself, so a server that ignores
    // repo_path would inspect the wrong repository.
    const transport = new StdioClientTransport({
      command: join(projectRoot, "node_modules", ".bin", "tsx"),
      args: [join(projectRoot, "src", "mcp-server.ts")],
      cwd: projectRoot,
      stderr: "ignore",
    });
    client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(transport);
  }, 20_000);

  afterAll(async () => {
    await client?.close();
    rmSync(repo, { recursive: true, force: true });
  });

  it("inspects the repository given in repo_path", async () => {
    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: repo, baseRef: "main" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0].text;
    expect(text).toContain(`# Review Report: ${repo}`);
    expect(text).toContain("- added.txt (added)");
  }, 20_000);
});
