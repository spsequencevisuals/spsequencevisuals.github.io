import { database, digest, failure, json, readJson, limitSubmissions } from "../../../lib/enquiries";
import { RequestError, requireSameOrigin, validateRequest } from "../../../lib/request-data.mjs";
import { prepareRequestEmail } from '../../../lib/notifications';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await limitSubmissions(request, 'attempt', 30, 60000);
    const data = validateRequest(await readJson(request));
    const db = database();
    const hash = await digest(JSON.stringify(data));
    const existing = await db.prepare("SELECT reference, payload_hash FROM enquiries WHERE id = ?").bind(data.id).first<{ reference: string; payload_hash: string }>();
    if (existing) {
      if (existing.payload_hash !== hash) throw new RequestError("This reference was already used. Start a new request.", 409);
      const email = await prepareRequestEmail({ id: data.id, kind: 'order', reference: existing.reference, intent: data.intent, request: data });
      return json({ reference: existing.reference, received: true, email });
    }
    const now = Date.now();
    await limitSubmissions(request, 'request', 10, 3600000, now);
    const reference = `SP-${data.id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    await db.prepare("INSERT INTO enquiries (id, reference, payload_hash, intent, name, email, phone, service, budget, preferred_date, preferred_time, details, reference_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?) ON CONFLICT(id) DO NOTHING")
      .bind(data.id, reference, hash, data.intent, data.name, data.email, data.phone, data.service, data.budget, data.preferredDate, data.preferredTime, data.details, data.referenceUrl, now, now).run();
    const saved = await db.prepare("SELECT reference, payload_hash FROM enquiries WHERE id = ?").bind(data.id).first<{ reference: string; payload_hash: string }>();
    if (!saved || saved.payload_hash !== hash) throw new RequestError("This reference was already used. Start a new request.", 409);
    const email = await prepareRequestEmail({ id: data.id, kind: 'order', reference: saved.reference, intent: data.intent, request: data });
    return json({ reference: saved.reference, received: true, email }, 201);
  } catch (error) { return failure(error); }
}
