import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function git(cwd: string, ...args: string[]) {
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
    cwd,
    stdio: "ignore",
  });
}

/** Temp repo: `main` with one commit, `feature` (checked out) adds `added.txt`. */
export function makeFixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "inspector-fixture-"));
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
