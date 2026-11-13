import type { ChangedFile, ValidationResult } from "./types.js";

type ReportInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }
  lines.push("", "## Validation output");
  for (const result of input.validationResults) {
    const detail = result.timedOut ? "timed out" : `exit ${result.exitCode ?? "signal"}`;
    lines.push(`### ${result.command} — ${result.status} (${detail})`, "```", result.output, "```");
  }
  return lines.join("\n");
}