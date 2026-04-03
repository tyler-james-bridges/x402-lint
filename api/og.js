import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          fontFamily: 'monospace',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: 72,
                fontWeight: 'bold',
                color: '#fff',
                letterSpacing: '0.1em',
              },
              children: '0x402.sh',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 28,
                color: '#666',
                marginTop: 20,
                letterSpacing: '0.05em',
              },
              children: 'x402 compliance checker -- paid via x402',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 22,
                color: '#444',
                marginTop: 30,
              },
              children: 'lint any endpoint -- get graded A-F against the V2 spec',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 18,
                color: '#333',
                marginTop: 20,
              },
              children: '$0.01 USDC / check -- Base (eip155:8453)',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 16,
                color: '#333',
                marginTop: 40,
              },
              children: 'built by @tmoney_145 -- deployed on bankr x402 cloud',
            },
          },
        ],
      },
    },
    { width: 1200, height: 630 }
  );
}
