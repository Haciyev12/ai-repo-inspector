import { execFileSync } from "node:child_process";
import type { ChangedFile } from "./types.js";

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
  }).trim();
}

/**
 * Resolves a user-supplied ref to a full commit SHA, or throws.
 * `--end-of-options` stops git from treating e.g. `--output=/x` as an option,
 * and only the resolved SHA is ever passed on to other git commands.
 */
function resolveCommit(repositoryPath: string, ref: string): string {
  try {
    return git(repositoryPath, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`]);
  } catch {
    throw new Error(`Invalid base ref: ${JSON.stringify(ref)} does not resolve to a commit.`);
  }
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = resolveCommit(repositoryPath, baseRef ?? "main");
  const output = git(repositoryPath, ["diff", "--name-status", "--end-of-options", `${base}...HEAD`]);

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, ...pathParts] = line.split("\t");
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { path: pathParts.join("\t"), status };
    });
}