export default [
  {
    files: ["**/*.js", "**/*.ts"],
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/", ".vercel/"],
  },
];
