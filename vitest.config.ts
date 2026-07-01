import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Fail the run if any focused test (it.only / describe.only) slips into CI,
    // so a debugging shortcut can never silently green a partial suite. Vitest's
    // key is `allowOnly` (the inverse of Playwright's `forbidOnly`); we make the
    // CI-disabling behaviour explicit rather than relying on the default.
    allowOnly: !process.env.CI,
  },
});
