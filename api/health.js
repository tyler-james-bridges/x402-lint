export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ alive: false, x402: false, error: 'method not allowed' });
  }

  const { url: targetUrl } = req.body || {};

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ alive: false, x402: false, error: "missing 'url' in request body" });
  }

  try { new URL(targetUrl); } catch {
    return res.status(400).json({ alive: false, x402: false, error: 'invalid url format' });
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'x402-lint/1.0' },
    });
  } catch (e) {
    return res.json({
      alive: false, x402: false, targetUrl,
      error: e?.message || 'network error',
    });
  }

  const is402 = response.status === 402;
  const hasPaymentHeader = Boolean(
    response.headers.get('payment-required') ||
    response.headers.get('x-payment-required') ||
    response.headers.get('x-payment')
  );

  return res.json({
    alive: true,
    x402: is402 && hasPaymentHeader,
    targetUrl,
    status: response.status,
    hasPaymentHeader,
  });
}
