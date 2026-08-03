import { defineConfig } from "vitest/config";

// Two test runners live in this repo now, and each owns a suffix:
// Vitest runs the unit tests, test/**/*.test.ts, and Playwright runs
// the end to end specs, test/e2e/*.spec.ts. Without this line Vitest
// would try to execute the Playwright specs and fail on their runner.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
