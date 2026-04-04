/**
 * x402-lint — Shared Lint & Health Engine
 *
 * Single source of truth for all lint/health logic.
 * Consumed by: server.js, api/lint.js, api/health.js, x402/lint/index.ts, x402/health/index.ts
 *
 * Security hardening:
 *   - SSRF blocklist (private IPs, cloud metadata, non-HTTP protocols)
 *   - Fetch timeout via AbortController (5s default)
 *   - URL validation beyond `new URL()`
 */

// ── SSRF Blocklist ──────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?(\/|$)/i,
  /^https?:\/\/127\.\d+\.\d+\.\d+/,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/0\.0\.0\.0/,
  // Link-local & cloud metadata
  /^https?:\/\/169\.254\.\d+\.\d+/,
  /^https?:\/\/metadata\.google\.internal/i,
  // RFC 1918 private ranges
  /^https?:\/\/10\.\d+\.\d+\.\d+/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^https?:\/\/192\.168\.\d+\.\d+/,
  // Non-HTTP protocols
  /^file:/i,
  /^ftp:/i,
  /^data:/i,
  /^javascript:/i,
];

const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = 'x402-lint/1.0';

/**
 * Validate a target URL is safe to fetch server-side.
 * Returns null if safe, or an error string if blocked.
 */
function validateTargetUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return "missing 'url' in request body";
  }

  try {
    const parsed = new URL(targetUrl);
    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `blocked protocol: ${parsed.protocol}`;
    }
  } catch {
    return 'invalid url format';
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(targetUrl)) {
      return 'blocked: target resolves to a private/internal address';
    }
  }

  return null; // safe
}

/**
 * Fetch with timeout. Returns the Response or throws.
 */
async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full x402 compliance lint.
 * Returns { ok, grade, score, targetUrl, status, version, findings }
 */
async function lint(targetUrl) {
  const validationError = validateTargetUrl(targetUrl);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const findings = [];
  let score = 100;

  // 1. Hit the target endpoint
  let res;
  try {
    res = await safeFetch(targetUrl, { method: 'GET' });
  } catch (err) {
    const msg = err?.name === 'AbortError'
      ? 'request timed out (5s limit)'
      : (err?.message || 'network error');
    return {
      ok: false, grade: 'F', score: 0, targetUrl,
      findings: [`[FAIL] could not reach endpoint: ${msg}`],
    };
  }

  // 2. Check for 402 status
  if (res.status !== 402) {
    findings.push(`[FAIL] expected http 402, got ${res.status}`);
    score -= 40;
  } else {
    findings.push('[PASS] returns http 402 payment required');
  }

  // 3. Check for V2 header (PAYMENT-REQUIRED)
  const paymentRequired = res.headers.get('payment-required');
  const xPayment = res.headers.get('x-payment');
  const xPaymentRequired = res.headers.get('x-payment-required');

  if (paymentRequired) {
    findings.push('[PASS] v2 payment-required header present');
  } else {
    findings.push('[FAIL] missing v2 payment-required header');
    score -= 25;
  }

  if (xPayment) {
    findings.push('[WARN] legacy x-payment header detected (v1 compat)');
    score -= 5;
  }

  if (xPaymentRequired) {
    findings.push('[WARN] found x-payment-required (deprecated, use payment-required)');
    score -= 5;
  }

  // 4. Decode and validate the payment payload
  const headerVal = paymentRequired || xPaymentRequired || xPayment;
  let decoded = null;

  if (headerVal) {
    try {
      const json = typeof Buffer !== 'undefined'
        ? Buffer.from(headerVal, 'base64').toString()
        : atob(headerVal);
      decoded = JSON.parse(json);
      findings.push('[PASS] payment header is valid base64-encoded json');
    } catch {
      findings.push('[FAIL] payment header is not valid base64 json');
      score -= 25;
    }
  } else {
    findings.push('[FAIL] no payment requirement header found at all');
    score -= 20;
  }

  // 5. Validate payment requirements structure
  if (decoded) {
    const accepts = decoded.accepts || decoded.paymentRequirements || (Array.isArray(decoded) ? decoded : null);

    if (!accepts || !Array.isArray(accepts) || accepts.length === 0) {
      findings.push('[FAIL] no payment options (accepts/paymentRequirements) found');
      score -= 15;
    } else {
      findings.push(`[PASS] found ${accepts.length} payment option(s)`);

      for (let i = 0; i < accepts.length; i++) {
        const opt = accepts[i];
        const p = `  option ${i + 1}:`;

        if (opt.scheme) {
          findings.push(`${p} scheme="${opt.scheme}"`);
        } else {
          findings.push(`${p} missing scheme`);
          score -= 5;
        }

        if (opt.network) {
          findings.push(`${p} network="${opt.network}"`);
          if (opt.network.startsWith('eip155:') || opt.network.startsWith('solana:')) {
            findings.push(`${p} caip-2 network format`);
          } else {
            findings.push(`${p} non-standard network format`);
            score -= 3;
          }
        } else {
          findings.push(`${p} missing network`);
          score -= 5;
        }

        if (opt.payTo) {
          findings.push(`${p} payTo present`);
        } else {
          findings.push(`${p} missing payTo`);
          score -= 10;
        }

        if (opt.price || opt.maxAmountRequired) {
          findings.push(`${p} price=${opt.price || opt.maxAmountRequired}`);
        } else {
          findings.push(`${p} missing price`);
          score -= 5;
        }
      }
    }

    if (decoded.description) {
      findings.push('[PASS] includes description metadata');
    } else {
      findings.push('[WARN] no description metadata (recommended)');
      score -= 2;
    }
  }

  // 6. Check response body pattern
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') && res.status === 402) {
    findings.push('[INFO] 402 response has json body (v1 pattern, v2 uses headers only)');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';

  return {
    ok: score >= 60, grade, score, targetUrl,
    status: res.status,
    version: paymentRequired ? 'v2' : xPayment ? 'v1' : 'unknown',
    findings,
  };
}

/**
 * Quick x402 health check.
 * Returns { alive, x402, targetUrl, status, hasPaymentHeader }
 */
async function healthCheck(targetUrl) {
  const validationError = validateTargetUrl(targetUrl);
  if (validationError) {
    return { alive: false, x402: false, error: validationError };
  }

  let res;
  try {
    res = await safeFetch(targetUrl, { method: 'GET' });
  } catch (err) {
    const msg = err?.name === 'AbortError'
      ? 'request timed out (5s limit)'
      : (err?.message || 'network error');
    return { alive: false, x402: false, targetUrl, error: msg };
  }

  const is402 = res.status === 402;
  const hasPaymentHeader = Boolean(
    res.headers.get('payment-required') ||
    res.headers.get('x-payment-required') ||
    res.headers.get('x-payment')
  );

  return { alive: true, x402: is402 && hasPaymentHeader, targetUrl, status: res.status, hasPaymentHeader };
}

module.exports = { lint, healthCheck, validateTargetUrl, safeFetch };
