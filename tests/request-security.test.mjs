import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, secureResponse } from '../lib/request-security.mjs';
import { requireSameOrigin } from '../lib/request-data.mjs';

const post = (body, headers = {}) => new Request('https://studio.example/api/requests', { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });
test('JSON accepts parameters but rejects lookalike content types', async () => {
  assert.deepEqual(await readJson(post('{"name":"SP"}', { 'content-type': 'Application/JSON; charset=utf-8' })), { name: 'SP' });
  for (const type of ['application/json-patch+json', 'application/jsonbad', 'text/plain', 'application/x-www-form-urlencoded']) await assert.rejects(readJson(post('{}', { 'content-type': type })), { status: 415 });
});
test('JSON limits declared and actual bytes, including multibyte inputs', async () => {
  await assert.rejects(readJson(post('{}', { 'content-length': '24001' })), { status: 413 });
  await assert.rejects(readJson(post(' '.repeat(24001), { 'content-length': '2' })), { status: 413 });
  await assert.rejects(readJson(post(JSON.stringify({ details: 'é'.repeat(12000) }))), { status: 413 });
  assert.deepEqual(await readJson(post('{"ok":true}')), { ok: true });
});
test('malformed JSON and invalid UTF-8 never reach persistence', async () => {
  await assert.rejects(readJson(post('{bad}')), { status: 400 });
  await assert.rejects(readJson(post(Uint8Array.from([123, 34, 120, 34, 58, 34, 195, 34, 125]))), { status: 400 });
});
test('browser writes require an exact origin and reject sibling-site requests', () => {
  const request = headers => new Request('https://studio.example/api/requests', { headers });
  requireSameOrigin(request({ origin: 'https://studio.example', 'sec-fetch-site': 'same-origin' }));
  requireSameOrigin(request({ origin: 'https://studio.example' }));
  for (const headers of [{}, { origin: 'null' }, { origin: 'https://studio.example.attacker.test' }, { origin: 'https://studio.example', 'sec-fetch-site': 'same-site' }, { origin: 'https://studio.example', 'sec-fetch-site': 'cross-site' }]) assert.throws(() => requireSameOrigin(request(headers)), { status: 403 });
});
test('production documents restrict executable content without blocking portfolio media', () => {
  const response = secureResponse(new Request('https://studio.example/'), new Response('<html></html>', { headers: { 'content-type': 'text/html', 'x-powered-by': 'example' } }));
  const directives = response.headers.get('content-security-policy').split('; ');
  assert.ok(directives.includes("script-src 'self'"));
  assert.ok(directives.includes("object-src 'none'"));
  assert.ok(directives.includes("base-uri 'none'"));
  assert.ok(directives.includes("media-src 'self' blob: https:"));
  assert.ok(directives.includes("worker-src 'self'"));
  assert.ok(directives.includes("connect-src 'self' https://api.web3forms.com"));
  assert.ok(directives.includes("form-action 'self' mailto:"));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
});
test('private endpoints cannot be cached and do not expose content on rejection', async () => {
  for (const path of ['/api/studio/requests', '/api/studio/requests?summary=1', '/studio', '/studio-inbox']) {
    const response = secureResponse(new Request('https://studio.example' + path), Response.json({ error: 'Sign in.' }, { status: 401, headers: { 'cache-control': 'public, max-age=600' } }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.deepEqual(await response.json(), { error: 'Sign in.' });
  }
});
test('security headers preserve streamed video ranges and cache semantics', async () => {
  const response = secureResponse(new Request('https://studio.example/portfolio-media/film'), new Response(Uint8Array.from([1, 2, 3]), { status: 206, headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-2/10', 'content-length': '3', 'cache-control': 'public, max-age=60' } }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 0-2/10');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), Uint8Array.from([1, 2, 3]));
});
test('development websocket allowances stay out of the production policy', () => {
  const request = new Request('http://terminal.local/');
  const development = secureResponse(request, new Response(''), { development: true }).headers.get('content-security-policy');
  const production = secureResponse(request, new Response('')).headers.get('content-security-policy');
  assert.ok(development.includes('ws: wss:'));
  assert.ok(!production.includes('ws:'));
  assert.ok(!production.includes("'unsafe-eval'"));
});
