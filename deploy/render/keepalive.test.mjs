import test from 'node:test';
import assert from 'node:assert/strict';
import { healthUrl, ping } from './keepalive.mjs';

test('only accepts a credential-free Render HTTPS origin', () => {
  assert.equal(healthUrl('https://example.onrender.com/').href, 'https://example.onrender.com/api/ping');
  for (const value of ['', 'http://example.onrender.com', 'https://onrender.com.evil.test',
    'https://x:y@example.onrender.com', 'https://example.onrender.com/v1',
    'https://example.onrender.com?token=secret']) assert.throws(() => healthUrl(value));
});
test('pings health only and refuses redirects', async () => {
  await ping('https://example.onrender.com', { request: async (url, options) => {
    assert.equal(url.pathname, '/api/ping');
    assert.equal(options.redirect, 'error');
    return Response.json({ status: 'ok' });
  }});
});
test('retries wake-up failure then succeeds', async () => {
  let calls = 0;
  await ping('https://example.onrender.com', { pause: async () => {}, request: async () => {
    if (++calls === 1) return new Response('', { status: 503 });
    return Response.json({ status: 'ok' });
  }});
  assert.equal(calls, 2);
});
test('fails after three unsuccessful responses', async () => {
  let calls = 0;
  await assert.rejects(ping('https://example.onrender.com', { pause: async () => {}, request: async () => {
    calls++; return Response.json({ status: 'unexpected' });
  }}), /Unexpected health response/);
  assert.equal(calls, 3);
});
