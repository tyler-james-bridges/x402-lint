/**
 * Bankr x402 Cloud handler — lint endpoint
 * Thin adapter over shared lint-engine.
 *
 * Bankr handlers use the Web API Request/Response pattern.
 * The shared engine returns plain objects; we wrap them in Response.json().
 */

// Bankr x402 Cloud runs in a Web API environment (no require).
// We inline the imports from lint-engine since Bankr doesn't support
// CommonJS require() — this is the one surface that must self-contain
// until Bankr supports ES module imports.
//
// TODO: When Bankr supports ESM imports, replace with:
//   import { lint } from '../../lib/lint-engine.js';

// ── Inlined from lib/lint-engine.js ─────────────────────────────

const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?(\/|$)/i,
  /^https?:\/\/127\.\d+\.\d+\.\d+/,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/0\.0\.0\.0/,
  /^https?:\/\/169\.254\.\d+\.\d+/,
  /^https?:\/\/metadata\.google\.internal/i,
  /^https?:\/\/10\.\d+\.\d+\.\d+/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^https?:\/\/192\.168\.\d+\.\d+/,
  /^file:/i, /^ftp:/i, /^data:/i, /^javascript:/i,
];

const FETCH_TIMEOUT_MS = 5000;

function validateTargetUrl(targetUrl: string | undefined): string | null {
  if (!targetUrl || typeof targetUrl !== 'string') return "missing 'url' in request body";
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return `blocked protocol: ${parsed.protocol}`;
  } catch { return 'invalid url format'; }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(targetUrl)) return 'blocked: target resolves to a private/internal address';
  }
  return null;
}

async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': 'x402-lint/1.0', ...(options.headers || {}) } });
  } finally { clearTimeout(timer); }
}

// ── Handler ─────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const targetUrl = body?.url;

    const validationError = validateTargetUrl(targetUrl);
    if (validationError) {
      return Response.json({ ok: false, error: validationError }, { status: 400 });
    }

    const findings: string[] = [];
    let score = 100;

    let res: Response;
    try {
      res = await safeFetch(targetUrl, { method: "GET" });
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'request timed out (5s limit)' : (e?.message || 'network error');
      return Response.json({ ok: false, grade: "F", score: 0, targetUrl, findings: [`[FAIL] could not reach endpoint: ${msg}`] });
    }

    if (res.status !== 402) { findings.push(`[FAIL] expected http 402, got ${res.status}`); score -= 40; }
    else { findings.push("[PASS] returns http 402 payment required"); }

    const paymentRequired = res.headers.get("payment-required");
    const xPayment = res.headers.get("x-payment");
    const xPaymentRequired = res.headers.get("x-payment-required");

    if (paymentRequired) { findings.push("[PASS] v2 payment-required header present"); }
    else { findings.push("[FAIL] missing v2 payment-required header"); score -= 25; }

    if (xPayment) { findings.push("[WARN] legacy x-payment header detected (v1 compat)"); score -= 5; }
    if (xPaymentRequired) { findings.push("[WARN] found x-payment-required (deprecated, use payment-required)"); score -= 5; }

    const headerVal = paymentRequired || xPaymentRequired || xPayment;
    let decoded: any = null;

    if (headerVal) {
      try {
        decoded = JSON.parse(atob(headerVal));
        findings.push("[PASS] payment header is valid base64-encoded json");
      } catch { findings.push("[FAIL] payment header is not valid base64 json"); score -= 25; }
    } else { findings.push("[FAIL] no payment requirement header found at all"); score -= 20; }

    if (decoded) {
      const accepts = decoded.accepts || decoded.paymentRequirements || (Array.isArray(decoded) ? decoded : null);

      if (!accepts || !Array.isArray(accepts) || accepts.length === 0) {
        findings.push("[FAIL] no payment options (accepts/paymentRequirements) found"); score -= 15;
      } else {
        findings.push(`[PASS] found ${accepts.length} payment option(s)`);
        for (let i = 0; i < accepts.length; i++) {
          const opt = accepts[i];
          const p = `  option ${i + 1}:`;
          if (opt.scheme) findings.push(`${p} scheme="${opt.scheme}"`);
          else { findings.push(`${p} missing scheme`); score -= 5; }
          if (opt.network) {
            findings.push(`${p} network="${opt.network}"`);
            if (opt.network.startsWith("eip155:") || opt.network.startsWith("solana:")) findings.push(`${p} caip-2 network format`);
            else { findings.push(`${p} non-standard network format`); score -= 3; }
          } else { findings.push(`${p} missing network`); score -= 5; }
          if (opt.payTo) findings.push(`${p} payTo present`);
          else { findings.push(`${p} missing payTo`); score -= 10; }
          if (opt.price || opt.maxAmountRequired) findings.push(`${p} price=${opt.price || opt.maxAmountRequired}`);
          else { findings.push(`${p} missing price`); score -= 5; }
        }
      }
      if (decoded.description) findings.push("[PASS] includes description metadata");
      else { findings.push("[WARN] no description metadata (recommended)"); score -= 2; }
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json") && res.status === 402) {
      findings.push("[INFO] 402 response has json body (v1 pattern, v2 uses headers only)");
    }

    score = Math.max(0, Math.min(100, score));
    const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";

    return Response.json({
      ok: score >= 60, grade, score, targetUrl,
      status: res.status,
      version: paymentRequired ? "v2" : xPayment ? "v1" : "unknown",
      findings,
    });
  } catch (e: any) {
    return Response.json({ ok: false, grade: "F", score: 0, findings: [`unhandled error: ${e?.message || "unknown"}`] }, { status: 500 });
  }
}
