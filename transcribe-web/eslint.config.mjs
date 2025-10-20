// eslint.config.mjs
import js from "@eslint/js";
import next from "eslint-config-next";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  ...next(), // včetně core-web-vitals

  // TS pravidla (type-checked)
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    rules: {
      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Čistota importů
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // Ignory
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "dist/",
      "coverage/",
      "**/*.d.ts",
    ],
  },
];
