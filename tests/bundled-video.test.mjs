import test from 'node:test';
import assert from 'node:assert/strict';
import { bundledVideoResponse } from '../lib/bundled-video.mjs';

const source = Uint8Array.from({ length: 25 }, (_, i) => i);
const asset = { filename: 'lesson.mp4', totalBytes: 25, chunkSize: 8, etag: 'lesson-hash', chunks: ['/0', '/1', '/2', '/3'] };
function fixture(honorRange = true) {
  const calls = [];
  const fetchAsset = async (path, headers) => {
    calls.push({ path, headers });
    const index = Number(path.slice(1));
    const chunk = source.slice(index * 8, (index + 1) * 8);
    if (!honorRange) return new Response(chunk);
    const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(headers.Range);
    return new Response(chunk.slice(Number(from), Number(to) + 1), { status: 206 });
  };
  return { calls, fetchAsset };
}
const request = (headers = {}, method = 'GET') => new Request('https://portfolio.example/portfolio-media/lesson', { headers, method });
const bytes = async response => new Uint8Array(await response.arrayBuffer());

test('a complete long video streams unchanged across static file boundaries', async () => {
  const { fetchAsset, calls } = fixture();
  const response = await bundledVideoResponse(request(), asset, fetchAsset);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.equal(response.headers.get('content-length'), '25');
  assert.deepEqual(await bytes(response), source);
  assert.equal(calls.length, 4);
});
test('seeking returns exactly the requested bytes across two file boundaries', async () => {
  for (const honorRange of [true, false]) {
    const { fetchAsset } = fixture(honorRange);
    const response = await bundledVideoResponse(request({ Range: 'bytes=6-18' }), asset, fetchAsset);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 6-18/25');
    assert.equal(response.headers.get('content-length'), '13');
    assert.deepEqual(await bytes(response), source.slice(6, 19));
  }
});
test('suffix requests return the final bytes, including a short final part', async () => {
  const { fetchAsset } = fixture();
  const response = await bundledVideoResponse(request({ Range: 'bytes=-4' }), asset, fetchAsset);
  assert.deepEqual(await bytes(response), source.slice(-4));
});
test('HEAD, cache validation and invalid ranges never read video parts', async () => {
  const { fetchAsset, calls } = fixture();
  assert.equal((await bundledVideoResponse(request({}, 'HEAD'), asset, fetchAsset)).headers.get('content-length'), '25');
  assert.equal((await bundledVideoResponse(request({ 'If-None-Match': '"lesson-hash"' }), asset, fetchAsset)).status, 304);
  const invalid = await bundledVideoResponse(request({ Range: 'bytes=99-' }), asset, fetchAsset);
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get('content-range'), 'bytes */25');
  assert.equal(calls.length, 0);
});
test('a stale If-Range gets the complete current video', async () => {
  const { fetchAsset } = fixture();
  const response = await bundledVideoResponse(request({ Range: 'bytes=2-5', 'If-Range': '"old-version"' }), asset, fetchAsset);
  assert.equal(response.status, 200);
  assert.deepEqual(await bytes(response), source);
});
test('consumer cancellation stops reading further video parts', async () => {
  const { fetchAsset, calls } = fixture();
  const response = await bundledVideoResponse(request(), asset, fetchAsset);
  const reader = response.body.getReader();
  assert.deepEqual((await reader.read()).value, source.slice(0, 8));
  await reader.cancel();
  assert.equal(calls.length, 1);
});
test('missing or truncated static parts fail instead of producing a corrupt successful download', async () => {
  assert.equal((await bundledVideoResponse(request(), asset, async () => new Response(null, { status: 404 }))).status, 502);
  const response = await bundledVideoResponse(request(), asset, async () => new Response(new Uint8Array([0, 1])));
  await assert.rejects(() => response.arrayBuffer());
});
test('cancellation releases a part whose upstream request was still pending', {timeout:2000}, async () => {
  let signalStarted, release, signalCancelled;
  const started=new Promise(resolve=>{signalStarted=resolve;});
  const gate=new Promise(resolve=>{release=resolve;});
  const cancelled=new Promise(resolve=>{signalCancelled=resolve;});
  let calls=0;
  const response=await bundledVideoResponse(request(),asset,async path=>{
    calls++;
    if(path==='/0')return new Response(source.slice(0,8));
    signalStarted();await gate;
    return new Response(new ReadableStream({start(controller){controller.enqueue(source.slice(8,16));},cancel(){signalCancelled();}}));
  });
  const reader=response.body.getReader();await reader.read();
  const pending=reader.read();await started;await reader.cancel();release();
  await cancelled;await pending;assert.equal(calls,2);
});
