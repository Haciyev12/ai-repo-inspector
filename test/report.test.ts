import { describe, expect, it } from "vitest";
import { markdownReport } from "../src/report.js";

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [{ command: "npm test", status: "passed", exitCode: 0, timedOut: false, output: "ok" }],
    });

    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
  });

  it("shows each validation's status, exit code and timeout", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [
        { command: "npm test", status: "failed", exitCode: 1, timedOut: false, output: "" },
        { command: "npm run e2e", status: "failed", exitCode: null, timedOut: true, output: "" },
      ],
    });

    expect(report).toContain("### npm test — failed (exit 1)");
    expect(report).toContain("### npm run e2e — failed (timed out)");
  });
});