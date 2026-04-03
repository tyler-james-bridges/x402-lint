export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "Method not allowed" },
        { status: 405 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetUrl = body?.url;

    if (!targetUrl || typeof targetUrl !== "string") {
      return Response.json(
        { ok: false, error: "Missing 'url' in request body" },
        { status: 400 }
      );
    }

    try {
      new URL(targetUrl);
    } catch {
      return Response.json(
        { ok: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "x402-lint/1.0" },
      });
    } catch (e: any) {
      return Response.json({
        alive: false,
        x402: false,
        targetUrl,
        error: e?.message || "network error",
      });
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
