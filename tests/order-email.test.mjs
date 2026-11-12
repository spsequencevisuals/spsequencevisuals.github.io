import test from 'node:test';
import assert from 'node:assert/strict';
import { emailPayload, prepareOnce, EMAIL_ENDPOINT, SITE_ORIGIN } from '../lib/order-email.mjs';
import '../public/request-email.js';
import { runWithBackgroundTasks, keepAlive } from '../lib/background-tasks.mjs';

const accessKey = '12345678-1234-4000-8000-123456789abc';
const order = { id: '20000000-0000-4000-8000-000000000001', kind: 'order', reference: 'SP-200000000000', intent: 'order', request: {
  name: 'Test client', email: 'client@example.invalid', phone: '+234000000000', service: 'Video editing', details: 'A complete project brief.', budget: 'To discuss', preferredDate: '2026-12-01', preferredTime: '14:00', referenceUrl: 'https://example.invalid/reference',
  password: 'never-forward-this', access_key: 'visitor-key-override', ccemail: 'attacker@example.invalid',
} };
let sendId = 0;
const submission = () => ({id: '30000000-0000-4000-8000-'+String(++sendId).padStart(12,'0'),fields:{...emailPayload(order),access_key:accessKey}});
const send = (event, fetcher, timeoutMs) => globalThis.SPRequestEmail.send(submission(), fetcher, timeoutMs);
const response = (value, status = 200) => Response.json(value, { status });
function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async claim(id, value) { if (rows.has(id)) return false; rows.set(id, value); return true; },
    async read(id) { return rows.get(id); },
    async finish(id, value) { rows.set(id, value); },
  };
}

test('request email includes the complete submitted brief and safe reply address only', () => {
  const payload = emailPayload(order);
  assert.equal(payload.name, order.request.name);
  assert.equal(payload.message, order.request.details);
  assert.equal(payload.email, order.request.email);
  assert.equal(payload.replyto, order.request.email);
  assert.equal(payload.request_reference, order.reference);
  assert.equal(payload.phone, order.request.phone);
  assert.equal(payload.preferred_time_WAT, '14:00');
  assert.equal(payload.private_studio, SITE_ORIGIN + '/studio-inbox');
  for (const field of ['password', 'access_key', 'ccemail', 'redirect']) assert.equal(payload[field], undefined);
  assert.throws(() => emailPayload({ ...order, reference: '\r\nBcc: attacker@example.invalid' }));
  assert.throws(() => emailPayload({ ...order, request: { ...order.request, email: 'client@example.invalid\r\nBcc: attacker@example.invalid' } }));
  assert.throws(() => emailPayload({ ...order, request: null }));
  assert.equal(emailPayload({ ...order, request: { ...order.request, details: 'x'.repeat(6000) } }).message.length, 5000);
  const setup = emailPayload({ kind: 'test' });
  assert.ok(setup.message.includes('test'));
  assert.equal(setup.email, 'spsequencevisuals@gmail.com');
});

test('missing configuration cannot consume a send claim or call the provider', async () => {
  for (const key of [undefined, '', 'not-a-key']) {
    const store = memoryStore();
    assert.equal((await prepareOnce(store, order, key)).state, 'configuration-required');
    assert.equal(store.rows.size, 0);
    let sends = 0;
    const result = await globalThis.SPRequestEmail.send({ ...submission(), fields: { access_key: key } }, async () => { sends++; });
    assert.equal(result.state, 'configuration-required');
    assert.equal(sends, 0);
  }
});

test('delivery uses the fixed brand destination and carries no visitor credentials', async () => {
  const result = await send(order, async (url, options) => {
    assert.equal(url, EMAIL_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    const body = JSON.parse(options.body);
    assert.equal(body.access_key, accessKey);
    assert.equal(body.ccemail, undefined);
    assert.equal(body.email, order.request.email);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.Cookie, undefined);
    return response({ success: true });
  });
  assert.equal(result.state, 'accepted');
});

test('only an explicit JSON boolean success is accepted', async () => {
  for (const value of [true]) assert.equal((await send(order, async () => response({ success: value }))).state, 'accepted');
  for (const value of [false]) assert.equal((await send(order, async () => response({ success: value }))).state, 'failed');
  for (const value of [1, 'yes', 'true', 'false', null]) assert.equal((await send(order, async () => response({ success: value }))).state, 'unknown');
});

test('ambiguous responses are never labelled as delivered or accepted', async () => {
  for (const result of [new Response('<html>gateway</html>'), response({}, 503), new Response(null, { status: 302, headers: { location: 'https://other.invalid/' } }), response(null), response({ success: true, padding: 'x'.repeat(66000) })]) {
    assert.equal((await send(order, async () => result)).state, 'unknown');
  }
  assert.equal((await send(order, async () => response({}, 403))).state, 'failed');
});

test('network errors and deadlines produce an unconfirmed outcome', async () => {
  const network = await send(order, async () => { throw new Error('Network unavailable'); });
  assert.equal(network.state, 'unknown');
  assert.equal(network.reason, 'network');
  const result = await send(order, async (_, options) => await new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true })), 5);
  assert.equal(result.state, 'unknown');
  assert.equal(result.reason, 'timeout');
});

test('simultaneous order retries receive only one email submission grant', async () => {
  const store = memoryStore();
  const results = await Promise.all(Array.from({ length: 10 }, () => prepareOnce(store, order, accessKey)));
  assert.equal(results.filter(value => value.submission).length, 1);
  assert.equal(store.rows.get(order.id).state, 'prepared');
  assert.equal((await prepareOnce(store, order, accessKey)).state, 'previously-prepared');
});

test('a single browser page never repeats an accepted, rejected or ambiguous email', async () => {
  for (const state of ['accepted', 'failed', 'unknown']) {
    const data = submission(); let sends = 0;
    const fetcher = async () => { sends++; await new Promise(resolve => setTimeout(resolve, 5)); if (state === 'unknown') throw Error('Disconnected'); return response({ success: state === 'accepted' }); };
    const results = await Promise.all(Array.from({ length: 10 }, () => globalThis.SPRequestEmail.send(data, fetcher)));
    assert.equal(sends, 1);
    assert.ok(results.every(result => result.state === state));
    assert.equal((await globalThis.SPRequestEmail.send(data, fetcher)).state, state);
    assert.equal(sends, 1);
  }
});

test('rate limiting is reported without an automatic retry or response-data leak', async () => {
  let calls = 0; const data = submission();
  const fetcher = async () => { calls++; return response({ success:false, access_key:accessKey, message:'Rate limit' },429); };
  const result = await globalThis.SPRequestEmail.send(data, fetcher);
  assert.deepEqual(result, {state:'failed',reason:'rate-limit'});
  await globalThis.SPRequestEmail.send(data, fetcher);
  assert.equal(calls,1);
  assert.ok(!JSON.stringify(result).includes(accessKey));
});

test('background execution contexts are isolated between simultaneous requests', async () => {
  const first = [], second = [];
  await Promise.all([
    runWithBackgroundTasks({ waitUntil: task => first.push(task) }, async () => { await new Promise(resolve => setTimeout(resolve, 8)); await keepAlive(Promise.resolve('first')); }),
    runWithBackgroundTasks({ waitUntil: task => second.push(task) }, async () => { await Promise.resolve(); await keepAlive(Promise.resolve('second')); }),
  ]);
  assert.deepEqual(await Promise.all(first), ['first']);
  assert.deepEqual(await Promise.all(second), ['second']);
});

test('fallback awaits work when a background context is absent', async () => {
  let finished = false;
  await keepAlive(Promise.resolve().then(() => { finished = true; }));
  assert.equal(finished, true);
});
