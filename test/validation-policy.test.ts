import { describe, expect, it } from "vitest";
import { disallowedCommands, parseAllowlist } from "../src/validation-policy.js";

describe("parseAllowlist", () => {
  it("treats unset or blank as an empty allowlist", () => {
    expect(parseAllowlist(undefined).size).toBe(0);
    expect(parseAllowlist("  ").size).toBe(0);
  });

  it("parses a JSON array of commands", () => {
    expect([...parseAllowlist('["npm test", "npm run lint"]')]).toEqual(["npm test", "npm run lint"]);
  });

  it.each(["npm test", "{}", '"npm test"', "[1]", '[""]', '["npm test", null]'])(
    "rejects malformed value %j",
    (raw) => {
      expect(() => parseAllowlist(raw)).toThrow(/JSON array/);
    },
  );
});

describe("disallowedCommands", () => {
  const allowlist = parseAllowlist('["npm test"]');

  it("allows exact matches only", () => {
    expect(disallowedCommands(["npm test"], allowlist)).toEqual([]);
    expect(disallowedCommands(["npm test ", "npm  test", "npm test && id", "NPM TEST"], allowlist)).toEqual([
      "npm test ",
      "npm  test",
      "npm test && id",
      "NPM TEST",
    ]);
  });
});
