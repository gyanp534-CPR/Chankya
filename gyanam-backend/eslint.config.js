import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "generated/**"],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "auth", pattern: "src/core/auth/**" },
        { type: "syllabus", pattern: "src/core/syllabus/**" },
        { type: "question-bank", pattern: "src/core/question-bank/**" },
        { type: "assessment", pattern: "src/core/assessment/**" },
        { type: "mastery", pattern: "src/core/mastery/**" },
        { type: "revision", pattern: "src/core/revision/**" },
        { type: "analytics", pattern: "src/core/analytics/**" },
        { type: "instrumentation", pattern: "src/core/instrumentation/**" },
        { type: "shared", pattern: "src/shared/**" },
        { type: "app", pattern: "src/*.ts" },
        { type: "config", pattern: "src/config/**" },
        { type: "plugins", pattern: "src/plugins/**" },
      ],
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    files: ["src/**/*.ts"],
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "auth", pattern: "src/core/auth/**" },
        { type: "syllabus", pattern: "src/core/syllabus/**" },
        { type: "question-bank", pattern: "src/core/question-bank/**" },
        { type: "assessment", pattern: "src/core/assessment/**" },
        { type: "mastery", pattern: "src/core/mastery/**" },
        { type: "revision", pattern: "src/core/revision/**" },
        { type: "analytics", pattern: "src/core/analytics/**" },
        { type: "instrumentation", pattern: "src/core/instrumentation/**" },
        { type: "shared", pattern: "src/shared/**" },
        { type: "app", pattern: "src/*.ts" },
        { type: "config", pattern: "src/config/**" },
        { type: "plugins", pattern: "src/plugins/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "app", allow: ["auth", "syllabus", "question-bank", "assessment", "mastery", "revision", "analytics", "instrumentation", "shared", "app", "config", "plugins"] },
            { from: "auth", allow: ["auth", "shared"] },
            { from: "syllabus", allow: ["syllabus", "shared"] },
            { from: "question-bank", allow: ["question-bank", "shared"] },
            { from: "assessment", allow: ["assessment", "shared"] },
            { from: "mastery", allow: ["mastery", "shared"] },
            { from: "revision", allow: ["revision", "shared"] },
            { from: "analytics", allow: ["analytics", "shared"] },
            { from: "instrumentation", allow: ["instrumentation", "shared"] },
            { from: "shared", allow: ["shared"] },
            { from: "config", allow: ["config", "shared"] },
            { from: "plugins", allow: ["plugins", "shared", "config"] }
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@core/*/infra/*"],
              message: "Import through each module's public index surface only.",
            },
          ],
        },
      ],
    },
  },
];
