import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // analysis/.venv holds installed Python packages, some of which ship their own
  // JavaScript (matplotlib's web backend). Linting a dependency's vendored code
  // is meaningless, and it only passed in CI because the checks job never
  // creates the virtual environment.
  // tools/ holds Node scripts, not browser code, so they get Node's
  // globals. Without this the linter calls `process` undefined, which
  // is true in a browser and false where these actually run.
  {
    files: ["tools/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  // .claude/ is harness scratch: agent worktrees carry full repo
  // copies, and linting one broke the root gates on 11 August 2026.
  {
    ignores: ["dist/", "public/mediapipe-wasm/", "analysis/.venv/", ".claude/"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: globals.browser } },
  {
    // The architectural spine: src/core is pure computation.
    // It may not import from the impure edges, and may not touch the browser.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/io/**", "**/ui/**"],
              message: "core must stay pure. It cannot import from io or ui.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "core must stay pure. No browser globals." },
        {
          name: "document",
          message: "core must stay pure. No browser globals.",
        },
        {
          name: "navigator",
          message: "core must stay pure. No browser globals.",
        },
      ],
    },
  },
  prettier,
);
