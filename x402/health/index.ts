/**
 * Bankr x402 Cloud handler — health endpoint
 * Inlines SSRF blocklist and fetch timeout (Bankr requires self-contained handlers).
 */

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

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const targetUrl = body?.url;

    const validationError = validateTargetUrl(targetUrl);
    if (validationError) {
      return Response.json({ alive: false, x402: false, error: validationError }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "x402-lint/1.0" },
      });
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'request timed out (5s limit)' : (e?.message || 'network error');
      return Response.json({ alive: false, x402: false, targetUrl, error: msg });
    } finally {
      clearTimeout(timer);
    }

    const is402 = res.status === 402;
    const hasPaymentHeader = Boolean(
      res.headers.get("payment-required") ||
      res.headers.get("x-payment-required") ||
      res.headers.get("x-payment")
    );

    return Response.json({
      alive: true,
      x402: is402 && hasPaymentHeader,
      targetUrl,
      status: res.status,
      hasPaymentHeader,
    });
  } catch (e: any) {
    return Response.json(
      { alive: false, x402: false, error: e?.message || "unknown" },
      { status: 500 }
    );
  }
}
