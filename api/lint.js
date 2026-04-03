export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const { url: targetUrl } = req.body || {};

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ ok: false, error: "missing 'url' in request body" });
  }

  try { new URL(targetUrl); } catch {
    return res.status(400).json({ ok: false, error: 'invalid url format' });
  }

  const findings = [];
  let score = 100;

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'x402-lint/1.0' },
    });
  } catch (e) {
    return res.json({
      ok: false, grade: 'F', score: 0, targetUrl,
      findings: [`could not reach endpoint: ${e?.message || 'network error'}`],
    });
  }

  if (response.status !== 402) {
    findings.push(`[FAIL] expected http 402, got ${response.status}`);
    score -= 40;
  } else {
    findings.push('[PASS] returns http 402 payment required');
  }

  const paymentRequired = response.headers.get('payment-required');
  const xPayment = response.headers.get('x-payment');
  const xPaymentRequired = response.headers.get('x-payment-required');

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

  const headerVal = paymentRequired || xPaymentRequired || xPayment;
  let decoded = null;

  if (headerVal) {
    try {
      const json = Buffer.from(headerVal, 'base64').toString();
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

        if (opt.scheme) findings.push(`${p} scheme="${opt.scheme}"`);
        else { findings.push(`${p} missing scheme`); score -= 5; }

        if (opt.network) {
          findings.push(`${p} network="${opt.network}"`);
          if (opt.network.startsWith('eip155:') || opt.network.startsWith('solana:'))
            findings.push(`${p} caip-2 network format`);
          else { findings.push(`${p} non-standard network format`); score -= 3; }
        } else { findings.push(`${p} missing network`); score -= 5; }

        if (opt.payTo) findings.push(`${p} payTo present`);
        else { findings.push(`${p} missing payTo`); score -= 10; }

        if (opt.price || opt.maxAmountRequired)
          findings.push(`${p} price=${opt.price || opt.maxAmountRequired}`);
        else { findings.push(`${p} missing price`); score -= 5; }
      }
    }

    if (decoded.description) findings.push('[PASS] includes description metadata');
    else { findings.push('[WARN] no description metadata (recommended)'); score -= 2; }
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') && response.status === 402)
    findings.push('[INFO] 402 response has json body (v1 pattern, v2 uses headers only)');

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';

  return res.json({
    ok: score >= 60, grade, score, targetUrl,
    status: response.status,
    version: paymentRequired ? 'v2' : xPayment ? 'v1' : 'unknown',
    findings,
  });
}
