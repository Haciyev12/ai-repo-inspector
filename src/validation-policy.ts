/**
 * Which validation commands an MCP caller may run.
 *
 * MCP callers are AI models and may be steered by content in the repository
 * they review, so they are not trusted to choose shell commands. Whoever
 * starts the server opts in to specific commands via an exact-match
 * allowlist; with none configured, no validation commands run at all.
 *
 * This applies to the MCP adapter only. The CLI runs `--validate` commands
 * as given, because the person typing them is the trust boundary.
 */
export const MCP_ALLOWLIST_ENV = "INSPECTOR_MCP_ALLOWED_VALIDATIONS";

/**
 * Parses the allowlist env var: a JSON array of command strings, e.g.
 * `["npm test","npm run lint"]`. Unset or empty means nothing is allowed.
 * Throws on anything malformed so a typo fails loudly at startup instead of
 * silently changing what is allowed.
 */
export function parseAllowlist(raw: string | undefined): ReadonlySet<string> {
  if (raw === undefined || raw.trim() === "") {
    return new Set();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${MCP_ALLOWLIST_ENV} must be a JSON array of strings, e.g. '["npm test"]'.`);
  }
  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string" && entry !== "")) {
    throw new Error(`${MCP_ALLOWLIST_ENV} must be a JSON array of non-empty strings, e.g. '["npm test"]'.`);
  }
  return new Set(parsed);
}

/** Returns the commands that are not exact matches of an allowlist entry. */
export function disallowedCommands(commands: readonly string[], allowlist: ReadonlySet<string>): string[] {
  return commands.filter((command) => !allowlist.has(command));
}
