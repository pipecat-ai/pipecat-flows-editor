import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@typescript-eslint": typescript,
      prettier,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          // Ignore parameters in type definitions (interfaces, type aliases)
          args: "none", // Don't check function arguments at all - TypeScript handles this
          // Only check variables, not parameters
          ignoreRestSiblings: true,
        },
      ],
      // Use the base no-unused-vars rule for variables, but let TypeScript handle parameters
      "no-unused-vars": "off", // Turn off base rule, use TypeScript-specific rule
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react/no-unescaped-entities": "off",
      "no-undef": "off", // TypeScript handles this
      "react/jsx-uses-react": "off", // Not needed in React 17+
      "prettier/prettier": "warn",
      "no-dupe-keys": "warn", // Allow duplicate keys (they may be intentional overrides)
      "no-empty": ["warn", { allowEmptyCatch: true }], // Allow empty catch blocks
      ...prettierConfig.rules,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];

