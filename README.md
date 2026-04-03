# x402-lint

x402 compliance checker — validate any x402-enabled API endpoint against the V2 spec. Paid via x402.

**yo dawg I heard you like x402 so I put x402 behind x402**

## What it does

Give it any URL. It hits the endpoint and checks:

- Returns HTTP 402 Payment Required
- V2 `PAYMENT-REQUIRED` header present (not legacy `X-Payment`)
- Valid base64-encoded JSON payload
- Payment options with scheme, network (CAIP-2), payTo, price
- Description metadata
- Flags deprecated V1 headers and patterns

Returns a letter grade (A-F), numeric score (0-100), and detailed findings.

## Live API (x402 Cloud)

```
POST https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint
```

**Price:** $0.01 USDC on Base

### Using Bankr CLI

```bash
bankr x402 call https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint -i
```

### Using x402-fetch

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";

const paidFetch = wrapFetchWithPayment(fetch, client);

const res = await paidFetch(
  "https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://your-x402-endpoint.com/api" }),
  }
);

const report = await res.json();
// { ok: true, grade: "B", score: 88, findings: [...] }
```

### Using curl (returns 402 — use with x402 client)

```bash
curl -X POST https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.ordiscan.com/v1/inscription/0"}'
```

## Local Development

Run the local server (no x402 payment required):

```bash
node server.js
# x402-lint running at http://localhost:8402
```

Open `http://localhost:8402` for the web UI.

### API

```bash
curl -X POST http://localhost:8402/api/lint \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.ordiscan.com/v1/inscription/0"}'
```

## Example Output

```json
{
  "ok": true,
  "grade": "B",
  "score": 88,
  "targetUrl": "https://api.ordiscan.com/v1/inscription/0",
  "status": 402,
  "version": "V2",
  "findings": [
    "[PASS] Returns HTTP 402 Payment Required",
    "[PASS] V2 PAYMENT-REQUIRED header present",
    "[WARN]  Found X-Payment-Required (deprecated, use PAYMENT-REQUIRED)",
    "[PASS] Payment header is valid base64-encoded JSON",
    "[PASS] Found 1 payment option(s)",
    "  Option 1: scheme=\"exact\" [PASS]",
    "  Option 1: network=\"eip155:8453\" [PASS]",
    "  Option 1: CAIP-2 network format [PASS]",
    "  Option 1: payTo present [PASS]",
    "  Option 1: missing price [FAIL]",
    "[WARN]  No description metadata (recommended)"
  ]
}
```

## Grading

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90-100 | Fully V2 compliant |
| B | 75-89 | Mostly compliant, minor issues |
| C | 60-74 | Functional but needs work |
| D | 45-59 | Significant issues |
| F | 0-44 | Non-compliant or unreachable |

## Stack

- Bankr x402 Cloud — hosting + x402 payment layer
- Node.js — local server
- x402 V2 spec — what we lint against

## Schema

**Input:**
```json
{
  "url": "https://your-x402-endpoint.com/api"
}
```

**Output:**
```json
{
  "ok": true,
  "grade": "A",
  "score": 95,
  "targetUrl": "https://...",
  "status": 402,
  "version": "V2",
  "findings": ["..."]
}
```

## Built on x402 Day

Built live on stream celebrating x402 joining the Linux Foundation (April 2, 2026).

The meta: an x402 compliance checker, paid via x402.

---

Built by [@tmoney_145](https://x.com/tmoney_145) · Deployed on [Bankr x402 Cloud](https://bankr.bot/x402)
