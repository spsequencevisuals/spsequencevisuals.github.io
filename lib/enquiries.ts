import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { isOwner, RequestError } from "./request-data.mjs";
export { readJson } from './request-security.mjs';

export function database() {
  if (!env.DB) throw new Error("Enquiry database is unavailable.");
  return env.DB;
}

export async function requireOwner() {
  const user = await getChatGPTUser();
  if (!user) throw new RequestError("Sign in to view your studio inbox.", 401);
  if (!isOwner(user)) throw new RequestError("Sign in with an approved SPSequence Visuals studio account.", 403);
  return user;
}

export function json(value: unknown, status = 200, extraHeaders = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders } });
}

export function failure(error: unknown) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status, 'retryAfter' in error ? { 'Retry-After': String(error.retryAfter) } : {});
  console.error("Studio request failed", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "Your request could not be saved. Please try again or email spsequencevisuals@gmail.com." }, 503);
}

export async function limitSubmissions(request: Request, scope: string, maximum: number, windowMs: number, now = Date.now()) {
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip) return; // Hosted requests receive this trusted header from Cloudflare.
  const window = Math.floor(now / windowMs);
  const key = await digest(`studio-${scope}:${ip}:${window}`);
  const db = database();
  const results = await db.batch<Record<string, unknown>>([
    db.prepare('INSERT INTO request_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key, (window + 2) * windowMs),
    db.prepare('SELECT count FROM request_limits WHERE key=?').bind(key),
    db.prepare('DELETE FROM request_limits WHERE expires_at < ?').bind(now),
  ]);
  if (Number(results[1].results[0]?.count) > maximum) {
    const retryAfter = Math.max(1, Math.ceil(((window + 1) * windowMs - now) / 1000));
    throw Object.assign(new RequestError('You’ve sent several requests recently. Please wait before trying again, or email SP directly.', 429), { retryAfter });
  }
}

export async function digest(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
