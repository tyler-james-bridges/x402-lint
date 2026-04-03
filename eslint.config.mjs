export default [
  {
    files: ["**/*.js"],
    rules: {
      "no-unused-vars": ["warn", { "caughtErrors": "none" }],
      "no-undef": "off",
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/", ".vercel/", "x402/"],
  },
];
