import config from "@zotero-plugin/eslint-config";

export default [
  ...config,
  {
    ignores: [
      "build/**",
      "node_modules/**",
      "addon/**",
      "*.js",
      "*.mjs",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
