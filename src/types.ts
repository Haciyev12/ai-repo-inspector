import type { ValidationOptions } from "./validation.js";

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked";
};

export type ValidationResult = {
  command: string;
  status: "passed" | "failed";
  /** null when the process was killed by a signal or failed to start. */
  exitCode: number | null;
  timedOut: boolean;
  /** Combined stdout+stderr, middle truncated beyond the output cap. */
  output: string;
};

export type ReviewResult = {
  markdown: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

export type ReviewRequest = {
  repositoryPath: string;
  baseRef?: string;
  validationCommands?: string[];
  /** Set by each interface; see validation.ts for the defaults. */
  validationOptions?: ValidationOptions;
  format?: "markdown" | "json";
};