#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { reviewRepository } from "./core.js";
import { DEFAULT_TIMEOUT_MS } from "./validation.js";

type Args = {
  command: string;
  repositoryPath?: string;
  baseRef?: string;
  format?: "markdown" | "json";
  validations: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? "", validations: [] };
  for (let index = 1; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--repo") {
      args.repositoryPath = argv[++index]?.split(" ")[0];
    } else if (token === "--base-ref") {
      args.baseRef = argv[++index];
    } else if (token === "--format") {
      args.format = argv[++index] as Args["format"];
    } else if (token === "--validate") {
      args.validations.push(argv[++index]);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== "review" || !args.repositoryPath) {
    console.error("Usage: inspector review --repo <path> [--base-ref <ref>] [--validate <command>]");
    process.exitCode = 1;
    return;
  }

  const result = await reviewRepository({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations,
    validationOptions: { timeoutMs: DEFAULT_TIMEOUT_MS },
    format: args.format,
  });
  writeFileSync("review-report.md", result.markdown, "utf8");
  console.log("Review report written to review-report.md");

  const failed = result.validationResults.filter((validation) => validation.status === "failed");
  if (failed.length > 0) {
    console.error(`${failed.length} validation command(s) failed: ${failed.map((v) => v.command).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});