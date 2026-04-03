# Contributing

Thanks for wanting to contribute to x402-lint.

## Setup

```bash
git clone https://github.com/tyler-james-bridges/x402-lint.git
cd x402-lint
npm install
node server.js
```

Open http://localhost:8402 to see the UI.

## Structure

```
x402/lint/index.ts    - Bankr x402 Cloud handler (full lint)
x402/health/index.ts  - Bankr x402 Cloud handler (health check)
api/lint.js           - Vercel serverless function (lint)
api/health.js         - Vercel serverless function (health)
server.js             - Local dev server
public/index.html     - Web UI
```

## Adding lint checks

New checks go in the handler functions. Each check should:
- Push a finding string to the `findings` array
- Use `[PASS]`, `[FAIL]`, `[WARN]`, or `[INFO]` prefixes
- Adjust the score (start at 100, subtract for issues)

## CI

PRs run lint + smoke tests automatically via GitHub Actions.

## Deploying

Vercel auto-deploys from `main`. Bankr endpoints need manual deploy:

```bash
bankr x402 deploy
```
