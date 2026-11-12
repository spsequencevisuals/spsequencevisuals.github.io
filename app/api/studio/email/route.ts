import { failure, json, limitSubmissions, readJson, requireOwner } from '../../../../lib/enquiries';
import { RequestError, requireSameOrigin } from '../../../../lib/request-data.mjs';
import { getEmailStatus, prepareStudioTest } from '../../../../lib/notifications';

export async function GET() {
  try { await requireOwner(); return json({ email: await getEmailStatus() }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    requireSameOrigin(request);
    const data = await readJson(request);
    if (!data || typeof data !== 'object' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.idempotencyKey)) throw new RequestError('Refresh the page and try again.', 400);
    await limitSubmissions(request, 'email-test', 5, 3600000);
    return json({ email: await prepareStudioTest(data.idempotencyKey) });
  } catch (error) { return failure(error); }
}
