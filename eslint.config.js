import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/"] },
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
