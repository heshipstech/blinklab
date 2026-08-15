import { defineConfig } from "vitest/config";

// Two test runners live in this repo now, and each owns a suffix:
// Vitest runs the unit tests, test/**/*.test.ts, and Playwright runs
// the end to end specs, test/e2e/*.spec.ts. Without this line Vitest
// would try to execute the Playwright specs and fail on their runner.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],

    // Roadmap 8.6, the coverage floor. src/core is the pure layer: no
    // browser imports, every measurement in it, and the place where an
    // untested branch turns into a published number nobody checked. It
    // measured 98.61% of statements when this was written, so the
    // floors below are not an aspiration, they are a ratchet against
    // the one direction that matters.
    //
    // Only src/core is measured. Extending this to main.ts would mean
    // choosing between a floor so low it permits anything and a
    // sudden demand to unit test 2,900 lines of DOM wiring that the
    // end to end suite already exercises. ARCHITECTURE.md makes the
    // same split for the same reason.
    //
    // functions sits at 100 on purpose. It is 100 today, and a pure
    // function nobody calls in a test is a function nobody has
    // checked; letting that slide is how core stops being the layer
    // you can trust.
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      reporter: ["text-summary"],
      thresholds: {
        statements: 98,
        branches: 95,
        functions: 100,
        lines: 98,
      },
    },
  },
});
