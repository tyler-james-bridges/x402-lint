# x402-lint

```
           __    __   ______    ______          __  __              __     
          /  |  /  | /      \  /      \        /  |/  |            /  |    
 __    __ $$ |  $$ |/$$$$$$  |/$$$$$$  |       $$ |$$/  _______   _$$ |_   
/  \  /  |$$ |__$$ |$$$  \$$ |$$____$$ |______ $$ |/  |/       \ / $$   |  
$$  \/$$/ $$    $$ |$$$$  $$ | /    $$//      |$$ |$$ |$$$$$$$  |$$$$$$/   
 $$  $$<  $$$$$$$$ |$$ $$ $$ |/$$$$$$/ $$$$$$/ $$ |$$ |$$ |  $$ |  $$ | __ 
 /$$$$  \       $$ |$$ \$$$$ |$$ |_____        $$ |$$ |$$ |  $$ |  $$ |/  |
/$$/ $$  |      $$ |$$   $$$/ $$       |       $$ |$$ |$$ |  $$ |  $$  $$/ 
$$/   $$/       $$/  $$$$$$/  $$$$$$$$/        $$/ $$/ $$/   $$/    $$$$/  
```

x402 compliance checker — validate any x402-enabled API endpoint against the V2 spec. Paid via x402.

**yo dawg I heard you like x402 so I put x402 behind x402**

[0x402.sh](https://0x402.sh) | [Bankr x402 Cloud](https://bankr.bot/x402) | [x402.org](https://x402.org) | [x402 spec](https://github.com/x402-foundation/x402)

## What it does

Give it any URL. It checks:

- Returns HTTP 402 Payment Required
- V2 `PAYMENT-REQUIRED` header present (not legacy `X-Payment`)
- Valid base64-encoded JSON payload
- Payment options with scheme, network (CAIP-2), payTo, price
- Description metadata
- Flags deprecated V1 headers and patterns

Returns a letter grade (A-F), numeric score (0-100), and detailed findings.

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `POST .../lint` | $0.01 USDC | Full compliance report with grade A-F |
| `POST .../health` | $0.001 USDC | Quick check: alive + x402 active? |

Base URL: `https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08`

Chain: Base (eip155:8453) / USDC

## Usage

### Bankr CLI

```bash
# full lint
bankr x402 call https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint -i

# health check
bankr x402 call https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/health -i
```

### curl (returns 402 — use with x402 client)

```bash
curl -X POST https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.ordiscan.com/v1/inscription/0"}'
```

### x402-fetch

```typescript
const res = await paidFetch(
  "https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/lint",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://api.ordiscan.com/v1/inscription/0" }),
  }
);
```

## Example Output

```json
{
  "ok": true,
  "grade": "B",
  "score": 88,
  "targetUrl": "https://api.ordiscan.com/v1/inscription/0",
  "status": 402,
  "version": "v2",
  "findings": [
    "[PASS] returns http 402 payment required",
    "[PASS] v2 payment-required header present",
    "[WARN] found x-payment-required (deprecated, use payment-required)",
    "[PASS] payment header is valid base64-encoded json",
    "[PASS] found 1 payment option(s)",
    "  option 1: scheme=\"exact\"",
    "  option 1: network=\"eip155:8453\"",
    "  option 1: caip-2 network format",
    "  option 1: payTo present",
    "  option 1: missing price",
    "[WARN] no description metadata (recommended)"
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

## Local Development

```bash
npm install
node server.js
# running at http://localhost:8402
```

Open [localhost:8402](http://localhost:8402) for the web UI.

## CI

- **CI** — ESLint + smoke tests on push/PR
- **x402 Self-Lint** — lints a known x402 endpoint weekly to verify the linter works

## License

MIT

---

Built by [@tmoney_145](https://x.com/tmoney_145) on x402 day (April 2, 2026). Deployed on [Bankr x402 Cloud](https://bankr.bot/x402).
