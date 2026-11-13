import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";
import { makeFixtureRepo } from "./fixtures.js";

describe("changedFiles baseRef validation", () => {
  let repo: string;

  beforeEach(() => {
    repo = makeFixtureRepo();
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("still diffs against a valid base ref", () => {
    expect(changedFiles(repo, "main")).toEqual([{ path: "added.txt", status: "added" }]);
  });

  it("rejects a base ref that git would parse as an option, without side effects", () => {
    const target = join(repo, "pwned");
    expect(() => changedFiles(repo, `--output=${target}`)).toThrow(/invalid base ref/i);
    // git's --output would create "<target>...HEAD"; nothing must be written.
    expect(readdirSync(repo).filter((name) => name.startsWith("pwned"))).toEqual([]);
    expect(existsSync(`${target}...HEAD`)).toBe(false);
  });

  it("rejects a base ref that does not resolve to a commit", () => {
    expect(() => changedFiles(repo, "no-such-branch")).toThrow(/invalid base ref/i);
  });
});
