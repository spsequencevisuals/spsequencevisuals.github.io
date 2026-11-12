import { env } from 'cloudflare:workers';
import { database } from './enquiries';
import { prepareOnce, EMAIL_RECIPIENT, EMAIL_PROVIDER, validAccessKey } from './order-email.mjs';

type EmailEvent = { id: string; kind: 'order' | 'test'; reference?: string; intent?: string; request?: Record<string, string> };
const enabled = () => env.EMAIL_ALERTS_ENABLED === 'true';
const configured = () => validAccessKey(env.WEB3FORMS_ACCESS_KEY);

export async function getEmailStatus() {
  return { recipient: EMAIL_RECIPIENT, provider: EMAIL_PROVIDER, enabled: enabled(), mode: 'browser', state: !enabled() ? 'disabled' : !configured() ? 'configuration-required' : 'ready' };
}

export async function prepareRequestEmail(event: EmailEvent) {
  const status = await getEmailStatus();
  if (status.state !== 'ready') return status;
  // This identifier is public by Web3Forms design. It can only route forms to
  // the verified recipient; no mailbox credentials leave the server.
  try {
    const store = {
      async claim(id: string, value: { state: string; checkedAt: number }) {
        const result = await database().prepare('INSERT INTO studio_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO NOTHING')
          .bind(`order_email:browser:${id}`, JSON.stringify(value), value.checkedAt).run();
        return result.meta.changes === 1;
      },
    };
    return { ...status, ...await prepareOnce(store, event, env.WEB3FORMS_ACCESS_KEY) };
  } catch {
    // A saved order must remain successful even if email setup is unavailable.
    return { ...status, state: 'unavailable' };
  }
}

export async function prepareStudioTest(id: string) {
  return prepareRequestEmail({ id: `test:${id}`, kind: 'test' });
}
