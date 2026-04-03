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

    // Validate it looks like a URL
    try {
      new URL(targetUrl);
    } catch {
      return Response.json(
        { ok: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const findings: string[] = [];
    let score = 100;

    // 1. Hit the target endpoint
    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "x402-lint/1.0" },
      });
    } catch (e: any) {
      return Response.json({
        ok: false,
        grade: "F",
        score: 0,
        targetUrl,
        findings: [`Could not reach endpoint: ${e?.message || "network error"}`],
      });
    }

    // 2. Check for 402 status
    if (res.status !== 402) {
      findings.push(`[FAIL] Expected HTTP 402, got ${res.status}`);
      score -= 40;
    } else {
      findings.push("[PASS] Returns HTTP 402 Payment Required");
    }

    // 3. Check for V2 header (PAYMENT-REQUIRED)
    const paymentRequired = res.headers.get("payment-required");
    const xPayment = res.headers.get("x-payment");
    const xPaymentRequired = res.headers.get("x-payment-required");

    if (paymentRequired) {
      findings.push("[PASS] V2 PAYMENT-REQUIRED header present");
    } else {
      findings.push("[FAIL] Missing V2 PAYMENT-REQUIRED header");
      score -= 25;
    }

    if (xPayment) {
      findings.push("[WARN]  Legacy X-Payment header detected (V1 compat)");
      score -= 5;
    }

    if (xPaymentRequired) {
      findings.push(
        "[WARN]  Found X-Payment-Required (deprecated, use PAYMENT-REQUIRED)"
      );
      score -= 5;
    }

    // 4. Decode and validate the payment payload
    const headerVal = paymentRequired || xPaymentRequired || xPayment;
    let decoded: any = null;

    if (headerVal) {
      try {
        const json = atob(headerVal);
        decoded = JSON.parse(json);
        findings.push("[PASS] Payment header is valid base64-encoded JSON");
      } catch {
        findings.push("[FAIL] Payment header is NOT valid base64 JSON");
        score -= 25;
      }
    } else {
      findings.push("[FAIL] No payment requirement header found at all");
      score -= 20;
    }

    // 5. Validate payment requirements structure
    if (decoded) {
      // V2 uses accepts array or paymentRequirements
      const accepts =
        decoded.accepts ||
        decoded.paymentRequirements ||
        (Array.isArray(decoded) ? decoded : null);

      if (!accepts || !Array.isArray(accepts) || accepts.length === 0) {
        findings.push("[FAIL] No payment options (accepts/paymentRequirements) found");
        score -= 15;
      } else {
        findings.push(`[PASS] Found ${accepts.length} payment option(s)`);

        // Check each option
        for (let i = 0; i < accepts.length; i++) {
          const opt = accepts[i];
          const prefix = `  Option ${i + 1}:`;

          if (opt.scheme) {
            findings.push(`${prefix} scheme="${opt.scheme}" [PASS]`);
          } else {
            findings.push(`${prefix} missing scheme [FAIL]`);
            score -= 5;
          }

          if (opt.network) {
            findings.push(`${prefix} network="${opt.network}" [PASS]`);
            // Check CAIP format
            if (
              opt.network.startsWith("eip155:") ||
              opt.network.startsWith("solana:")
            ) {
              findings.push(`${prefix} CAIP-2 network format [PASS]`);
            } else {
              findings.push(`${prefix} non-standard network format [WARN]`);
              score -= 3;
            }
          } else {
            findings.push(`${prefix} missing network [FAIL]`);
            score -= 5;
          }

          if (opt.payTo) {
            findings.push(`${prefix} payTo present [PASS]`);
          } else {
            findings.push(`${prefix} missing payTo [FAIL]`);
            score -= 10;
          }

          if (opt.price || opt.maxAmountRequired) {
            findings.push(
              `${prefix} price=${opt.price || opt.maxAmountRequired} [PASS]`
            );
          } else {
            findings.push(`${prefix} missing price [FAIL]`);
            score -= 5;
          }
        }
      }

      // Check for description and mimeType (nice-to-haves)
      if (decoded.description) {
        findings.push("[PASS] Includes description metadata");
      } else {
        findings.push("[WARN]  No description metadata (recommended)");
        score -= 2;
      }
    }

    // 6. Check response body (V2 moved data to headers, body should be free)
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json") && res.status === 402) {
      findings.push(
        "[INFO]  402 response has JSON body (V1 pattern — V2 uses headers only)"
      );
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    const grade =
      score >= 90
        ? "A"
        : score >= 75
          ? "B"
          : score >= 60
            ? "C"
            : score >= 45
              ? "D"
              : "F";

    return Response.json({
      ok: score >= 60,
      grade,
      score,
      targetUrl,
      status: res.status,
      version: paymentRequired ? "V2" : xPayment ? "V1" : "unknown",
      findings,
    });
  } catch (e: any) {
    return Response.json(
      {
        ok: false,
        grade: "F",
        score: 0,
        findings: [`Unhandled error: ${e?.message || "unknown"}`],
      },
      { status: 500 }
    );
  }
}
