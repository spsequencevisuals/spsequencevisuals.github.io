import { RequestError } from './request-data.mjs';

// Limit bytes before decoding or parsing; Content-Length alone is not trusted.
export async function readJson(request, maximum = 24000) {
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new RequestError('Please submit the form on this page.', 415);
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new RequestError('Your request is too long. Please shorten the details.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Your request is empty.');
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) { await reader.cancel(); throw new RequestError('Your request is too long. Please shorten the details.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new RequestError('Please check your request and try again.'); }
}

export function secureResponse(request, response, { development = false } = {}) {
  const headers = new Headers(response.headers);
  const script = development ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  const connect = development ? "'self' ws: wss:" : "'self'";
  headers.set('Content-Security-Policy', [
    "default-src 'self'", `script-src ${script}`, "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self'", "media-src 'self' blob: https:",
    `connect-src ${connect} https://api.web3forms.com`, "worker-src 'self'", "object-src 'none'", "base-uri 'none'",
    "form-action 'self' mailto:", "frame-src 'self'",
    "frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://*.chatgpt-team.site",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ].join('; '));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)');
  if (/^\/(?:api(?:\/|$)|studio(?:-inbox)?(?:\/|$))/.test(new URL(request.url).pathname)) {
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  headers.delete('X-Powered-By');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
