import { database, failure, json, requireOwner } from "../../../../lib/enquiries";
import { getEmailStatus } from '../../../../lib/notifications';

export async function GET(request: Request) {
  try {
    await requireOwner();
    const db = database();
    if (new URL(request.url).searchParams.get('summary') === '1') {
      const counts = await db.prepare('SELECT status, COUNT(*) AS total FROM enquiries GROUP BY status').all();
      return json({ counts: counts.results, email: await getEmailStatus() });
    }
    const cursor = new URL(request.url).searchParams.get("before");
    const [timestamp, beforeId = "~"] = cursor ? cursor.split(":") : [String(Date.now() + 1)];
    const before = Number(timestamp);
    if (!Number.isSafeInteger(before) || before < 0 || (cursor && !/^[a-f0-9-]{36}$/.test(beforeId))) return json({ error: "Invalid page reference." }, 400);
    const [rows, counts] = await db.batch<Record<string, unknown>>([
      db.prepare("SELECT id, reference, intent, name, email, phone, service, budget, preferred_date, preferred_time, details, reference_url, status, created_at, updated_at FROM enquiries WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC, id DESC LIMIT 101").bind(before, before, beforeId),
      db.prepare("SELECT status, COUNT(*) AS total FROM enquiries GROUP BY status"),
    ]);
    const items = rows.results.slice(0, 100);
    const last = items[items.length - 1];
    const nextCursor = rows.results.length > 100 ? `${last.created_at}:${last.id}` : null;
    return json({ items, counts: counts.results, nextCursor, email: await getEmailStatus() });
  } catch (error) { return failure(error); }
}
