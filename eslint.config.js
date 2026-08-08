import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // analysis/.venv holds installed Python packages, some of which ship their own
  // JavaScript (matplotlib's web backend). Linting a dependency's vendored code
  // is meaningless, and it only passed in CI because the checks job never
  // creates the virtual environment.
  { ignores: ["dist/", "public/mediapipe-wasm/", "analysis/.venv/"] },
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
