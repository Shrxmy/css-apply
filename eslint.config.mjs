import { dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "node:module";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  // Resolve Next's transitive plugins without relying on pnpm hoisting.
  resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next")),
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-dev/**",
      "out/**",
      "build/**",
      "src/generated/**",
      "next-env.d.ts",
      "scripts/**",
      "*.js",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["tests/**/*.cjs"],
    // Offline Node tests intentionally use CommonJS and mock module objects.
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
