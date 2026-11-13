import { changedFiles } from "./git.js";
import { markdownReport } from "./report.js";
import type { ReviewRequest, ReviewResult } from "./types.js";
import { runValidations } from "./validation.js";

export async function reviewRepository(request: ReviewRequest): Promise<ReviewResult> {
  const files = changedFiles(request.repositoryPath, request.baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    request.repositoryPath,
    request.validationOptions,
  );
  return {
    markdown: markdownReport({
      repositoryPath: request.repositoryPath,
      changedFiles: files,
      validationResults: validations,
    }),
    changedFiles: files,
    validationResults: validations,
  };
}
