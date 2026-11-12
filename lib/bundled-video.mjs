import { parseRange } from './studio-data.mjs';

// A normal seekable MP4 response backed by small, immutable static files.
// Only one upstream reader is active; the full film is never buffered here.
export async function bundledVideoResponse(request, asset, fetchAsset) {
  if (!asset) return new Response('Video not found.', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const etag = '"' + asset.etag + '"';
  const baseHeaders = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'ETag': etag,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=3600, must-revalidate',
    'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(asset.filename),
  };
  const match = request.headers.get('if-none-match');
  if (match && (match === '*' || match.split(',').some(value => value.trim().replace(/^W\//, '') === etag))) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }
  let range;
  try {
    const ifRange = request.headers.get('if-range');
    range = parseRange(!ifRange || ifRange === etag ? request.headers.get('range') : null, asset.totalBytes);
  } catch {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${asset.totalBytes}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' } });
  }
  const start = range?.offset ?? 0;
  const length = range?.length ?? asset.totalBytes;
  const end = start + length - 1;
  const headers = new Headers({ ...baseHeaders, 'Content-Length': String(length) });
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${asset.totalBytes}`);
  const status = range ? 206 : 200;
  if (request.method === 'HEAD') return new Response(null, { status, headers });

  function partAt(cursor) {
    const index = Math.floor(cursor / asset.chunkSize);
    const localStart = cursor - index * asset.chunkSize;
    const localEnd = Math.min(end - index * asset.chunkSize, asset.chunkSize - 1);
    return { path: asset.chunks[index], localStart, localEnd, length: localEnd - localStart + 1 };
  }
  async function openPart(part) {
    if (!part.path) throw new Error('Missing video segment.');
    const response = await fetchAsset(part.path, { Range: `bytes=${part.localStart}-${part.localEnd}` });
    if (![200, 206].includes(response.status) || !response.body) throw new Error('Video segment unavailable.');
    return { reader: response.body.getReader(), skip: response.status === 206 ? 0 : part.localStart, remaining: part.length };
  }
  let active;
  try { active = await openPart(partAt(start)); }
  catch { return new Response('This video is temporarily unavailable.', { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
  let cursor = start;
  let cancelled = false;
  const body = new ReadableStream({
    async pull(controller) {
      try {
        while (!cancelled) {
          if (cursor > end) { controller.close(); return; }
          if (!active) active = await openPart(partAt(cursor));
          if (cancelled) { await active.reader.cancel(); active = null; return; }
          const current = active;
          const { value, done } = await current.reader.read();
          if (cancelled) return;
          if (done) throw new Error('Video segment was truncated.');
          let bytes = value;
          if (current.skip) {
            const skip = Math.min(current.skip, bytes.byteLength);
            current.skip -= skip;
            bytes = bytes.subarray(skip);
          }
          if (!bytes.byteLength) continue;
          const take = Math.min(current.remaining, bytes.byteLength);
          current.remaining -= take;
          cursor += take;
          controller.enqueue(bytes.subarray(0, take));
          if (!current.remaining) {
            active = null;
            await current.reader.cancel();
          }
          if (!cancelled && cursor > end) controller.close();
          return;
        }
      } catch (error) {
        await active?.reader.cancel().catch(() => {});
        if (!cancelled) controller.error(error);
      }
    },
    async cancel(reason) {
      cancelled = true;
      await active?.reader.cancel(reason).catch(() => {});
      active = null;
    },
  }, { highWaterMark: 0 });
  return new Response(body, { status, headers });
}
