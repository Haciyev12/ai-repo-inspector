#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { disallowedCommands, MCP_ALLOWLIST_ENV, MCP_VALIDATION_OPTIONS, parseAllowlist } from "./validation-policy.js";

let allowedValidations: ReadonlySet<string>;
try {
  allowedValidations = parseAllowlist(process.env[MCP_ALLOWLIST_ENV]);
} catch (error) {
  console.error(`repository-inspector: ${(error as Error).message}`);
  process.exit(1);
}

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

const reviewRepositoryInput = {
  repo_path: z.string().describe("Repository path to inspect."),
  baseRef: z.string().optional(),
  validationCommands: z
    .array(z.string())
    .optional()
    .describe(
      `Commands to run in the repository. Each must exactly match an entry in the server's ` +
        `${MCP_ALLOWLIST_ENV} allowlist; otherwise the call fails and nothing runs.`,
    ),
};

type ReviewRepositoryInput = z.infer<z.ZodObject<typeof reviewRepositoryInput>>;

const allowedDescription =
  allowedValidations.size === 0
    ? "This server allows no validation commands."
    : `This server allows exactly these validation commands: ${JSON.stringify([...allowedValidations])}.`;

server.tool(
  "review_repository",
  "Inspects a Git repository and returns a review report. " +
    `validationCommands are disabled unless the server operator allowlists exact commands via ` +
    `${MCP_ALLOWLIST_ENV}. ${allowedDescription} ` +
    "Note: the inspector CLI runs any --validate command as given; running the CLI through a " +
    "shell is not covered by this allowlist.",
  reviewRepositoryInput,
  async (input: ReviewRepositoryInput) => {
    const validationCommands = input.validationCommands ?? [];
    const rejected = disallowedCommands(validationCommands, allowedValidations);
    if (rejected.length > 0) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text:
              `Validation commands not allowed by this server: ${JSON.stringify(rejected)}. ` +
              `Nothing was run. ${allowedDescription}`,
          },
        ],
      };
    }

    const result = await reviewRepository({
      repositoryPath: input.repo_path,
      baseRef: input.baseRef,
      validationCommands,
      validationOptions: MCP_VALIDATION_OPTIONS,
    });
    return { content: [{ type: "text", text: result.markdown }] };
  },
);

await server.connect(new StdioServerTransport());
