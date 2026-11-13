import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run the TypeScript sources. `npm run build` also emits compiled
    // copies under dist/test/, which must not be collected as a second suite.
    include: ["test/**/*.test.ts"],
  },
});
