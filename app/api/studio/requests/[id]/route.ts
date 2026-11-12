import { database, failure, json, readJson, requireOwner } from "../../../../../lib/enquiries";
import { STATUSES, requireSameOrigin } from "../../../../../lib/request-data.mjs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    requireSameOrigin(request);
    const { id } = await context.params;
    const { status } = await readJson(request);
    if (!STATUSES.includes(status)) return json({ error: "Choose a valid request status." }, 400);
    const result = await database().prepare("UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ?").bind(status, Date.now(), id).run();
    if (!result.meta.changes) return json({ error: "This request could not be found." }, 404);
    return json({ saved: true, status });
  } catch (error) { return failure(error); }
}
