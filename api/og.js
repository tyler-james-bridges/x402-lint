export default function handler(req, res) {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#000"/>
    <text x="600" y="220" font-family="monospace" font-size="72" font-weight="bold" fill="#fff" text-anchor="middle">0x402.sh</text>
    <text x="600" y="310" font-family="monospace" font-size="28" fill="#666" text-anchor="middle">x402 compliance checker -- paid via x402</text>
    <text x="600" y="400" font-family="monospace" font-size="22" fill="#444" text-anchor="middle">lint any x402 endpoint -- get graded A-F against the V2 spec</text>
    <text x="600" y="460" font-family="monospace" font-size="18" fill="#333" text-anchor="middle">$0.01 USDC / check -- Base (eip155:8453)</text>
    <text x="600" y="560" font-family="monospace" font-size="16" fill="#333" text-anchor="middle">built by @tmoney_145 -- deployed on bankr x402 cloud</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(svg);
}
