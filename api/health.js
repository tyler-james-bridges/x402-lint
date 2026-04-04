const { healthCheck } = require('../lib/lint-engine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ alive: false, x402: false, error: 'method not allowed' });
  }

  const { url: targetUrl } = req.body || {};
  const result = await healthCheck(targetUrl);

  return res.json(result);
}
