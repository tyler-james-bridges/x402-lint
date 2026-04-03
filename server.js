const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8402;

async function lint(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { ok: false, error: "missing 'url' in request body", status: 400 };
  }

  try { new URL(targetUrl); } catch {
    return { ok: false, error: 'invalid url format', status: 400 };
  }

  const findings = [];
  let score = 100;

  let res;
  try {
    res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'x402-lint/1.0' },
    });
  } catch (err) {
    return {
      ok: false, grade: 'F', score: 0, targetUrl,
      findings: [`could not reach endpoint: ${err?.message || 'network error'}`],
    };
  }

  if (res.status !== 402) {
    findings.push(`expected http 402, got ${res.status}`);
    score -= 40;
  } else {
    findings.push('returns http 402 payment required');
  }

  const paymentRequired = res.headers.get('payment-required');
  const xPayment = res.headers.get('x-payment');
  const xPaymentRequired = res.headers.get('x-payment-required');

  if (paymentRequired) {
    findings.push('v2 payment-required header present');
  } else {
    findings.push('missing v2 payment-required header');
    score -= 25;
  }

  if (xPayment) {
    findings.push('legacy x-payment header detected (v1 compat)');
    score -= 5;
  }

  if (xPaymentRequired) {
    findings.push('found x-payment-required (deprecated, use payment-required)');
    score -= 5;
  }

  const headerVal = paymentRequired || xPaymentRequired || xPayment;
  let decoded = null;

  if (headerVal) {
    try {
      const json = Buffer.from(headerVal, 'base64').toString();
      decoded = JSON.parse(json);
      findings.push('payment header is valid base64-encoded json');
    } catch {
      findings.push('payment header is not valid base64 json');
      score -= 25;
    }
  } else {
    findings.push('no payment requirement header found at all');
    score -= 20;
  }

  if (decoded) {
    const accepts = decoded.accepts || decoded.paymentRequirements || (Array.isArray(decoded) ? decoded : null);

    if (!accepts || !Array.isArray(accepts) || accepts.length === 0) {
      findings.push('no payment options (accepts/paymentRequirements) found');
      score -= 15;
    } else {
      findings.push(`found ${accepts.length} payment option(s)`);

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
      findings.push('includes description metadata');
    } else {
      findings.push('no description metadata (recommended)');
      score -= 2;
    }
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') && res.status === 402) {
    findings.push('402 response has json body (v1 pattern, v2 uses headers only)');
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';

  return {
    ok: score >= 60, grade, score, targetUrl,
    status: res.status,
    version: paymentRequired ? 'v2' : xPayment ? 'v1' : 'unknown',
    findings,
  };
}

async function healthCheck(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { alive: false, x402: false, error: "missing 'url' in request body" };
  }
  try { new URL(targetUrl); } catch {
    return { alive: false, x402: false, error: 'invalid url format' };
  }
  let res;
  try {
    res = await fetch(targetUrl, {
      method: 'GET', redirect: 'follow',
      headers: { 'User-Agent': 'x402-lint/1.0' },
    });
  } catch (err) {
    return { alive: false, x402: false, targetUrl, error: err?.message || 'network error' };
  }
  const is402 = res.status === 402;
  const hasPaymentHeader = Boolean(
    res.headers.get('payment-required') ||
    res.headers.get('x-payment-required') ||
    res.headers.get('x-payment')
  );
  return { alive: true, x402: is402 && hasPaymentHeader, targetUrl, status: res.status, hasPaymentHeader };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/health') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const result = await healthCheck(parsed.url);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ alive: false, x402: false, error: 'invalid request' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lint') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const result = await lint(parsed.url);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid request' }));
      }
    });
    return;
  }

  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`x402-lint running at http://localhost:${PORT}`);
});
