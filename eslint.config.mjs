import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

const eslintConfig = [
  {
    ignores: [".next/**", "next-env.d.ts", "node_modules/**"],
  },
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "*.ts", "*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];

export default eslintConfig;
