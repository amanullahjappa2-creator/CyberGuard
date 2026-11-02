import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "playwright-report/**", "test-results/**"],
  },
  js.configs.recommended,
  {
    files: [
      "js/**/*.js",
      "tests/**/*.js",
      "scripts/**/*.mjs",
      "e2e/**/*.js",
      "playwright.config.js",
      "service-worker.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
