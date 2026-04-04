const http = require('http');
const fs = require('fs');
const path = require('path');
const { lint, healthCheck } = require('./lib/lint-engine');

const PORT = 8402;
const MAX_BODY = 4096; // 4KB — plenty for { "url": "..." }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY) {
        req.destroy();
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/health') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      const result = await healthCheck(parsed.url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      if (e.message === 'body too large') {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ alive: false, x402: false, error: 'request body too large' }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ alive: false, x402: false, error: 'invalid request' }));
      }
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lint') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      const result = await lint(parsed.url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      if (e.message === 'body too large') {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'request body too large' }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid request' }));
      }
    }
    return;
  }

  // Static file serving with path traversal protection
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);
  const resolved = path.resolve(filePath);
  const publicDir = path.resolve(path.join(__dirname, 'public'));

  if (!resolved.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  const ext = path.extname(resolved);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

  fs.readFile(resolved, (err, data) => {
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
