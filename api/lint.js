const { lint } = require('../lib/lint-engine');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const { url: targetUrl } = req.body || {};
  const result = await lint(targetUrl);

  if (result.status === 400) {
    return res.status(400).json(result);
  }

  return res.json(result);
}
