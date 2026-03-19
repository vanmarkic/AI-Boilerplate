import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  // ── App code: strict rules ─────────────────────────────────
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.spec.ts", "src/**/*.stories.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Rule 1: Ban unsafe type assertions.
      // Prevents `as unknown as X` that hides type mismatches
      // at integration boundaries (WS payloads, API responses).
      // DOM narrowing (EventTarget → HTMLInputElement) is allowed
      // via the rule's built-in understanding of type hierarchies.
      "@typescript-eslint/no-unsafe-type-assertion": "error",

      // Rule 2: Ban loose index signatures in interfaces.
      // Catches `{ [key: string]: unknown }` that swallows type
      // information. Forces discriminated unions instead.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSIndexSignature",
          message:
            "Index signatures ([key: string]: ...) bypass type safety. Use a discriminated union or explicit properties instead.",
        },
      ],
    },
  },

  // ── Test files: relax assertion rule ───────────────────────
  {
    files: ["src/**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Tests legitimately need `as` casts for mocks/fixtures.
      "@typescript-eslint/no-unsafe-type-assertion": "off",

      // Still enforce no index signatures in tests.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSIndexSignature",
          message:
            "Index signatures ([key: string]: ...) bypass type safety. Use a discriminated union or explicit properties instead.",
        },
      ],
    },
  },
];
