// Email the contact fields and brief explicitly submitted for SP to reply.
// The brand destination is bound to the configured form identifier; never forward arbitrary
// request fields, credentials, cookies or authentication headers.
export const EMAIL_RECIPIENT = 'spsequencevisuals@gmail.com';
export const SITE_ORIGIN = 'https://sp-sequence-visuals.digitaldreamshub2020.chatgpt.site';
export const EMAIL_ENDPOINT = 'https://api.web3forms.com/submit';
export const EMAIL_PROVIDER = 'Web3Forms';
export const validAccessKey = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.trim());

export function emailPayload(event) {
  const test = event.kind === 'test';
  if (!test && !/^SP-[A-F0-9]{12}$/.test(event.reference)) throw new Error('Invalid notification reference.');
  const config = {
    subject: test ? 'SPSequence Visuals — email alert setup / test' : `New SPSequence Visuals request — ${event.reference}`,
    from_name: 'SPSequence Visuals website',
    website: `${SITE_ORIGIN}/`,
  };
  if (test) return { ...config, name: 'SPSequence Visuals', email: EMAIL_RECIPIENT, message: `This is a test of website request emails to ${EMAIL_RECIPIENT}. Open your private Studio Inbox: ${SITE_ORIGIN}/studio-inbox` };
  const data = event.request;
  if (!data || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 200) throw new Error('Invalid reply address.');
  const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  return {
    ...config,
    name: text(data.name, 100),
    email: data.email,
    replyto: data.email,
    request_reference: event.reference,
    request_type: event.intent === 'session' ? 'Session request' : 'Creative service request',
    service: text(data.service, 100),
    message: text(data.details, 5000),
    phone: text(data.phone, 40),
    budget: text(data.budget, 100),
    preferred_date: text(data.preferredDate, 10),
    preferred_time_WAT: text(data.preferredTime, 5),
    inspiration_link: text(data.referenceUrl, 1000),
    private_studio: `${SITE_ORIGIN}/studio-inbox`,
  };
}

// The free provider requires a real browser submission. Claim the send before
// returning its public form identifier, so re-posting an order cannot send twice.
export async function prepareOnce(store, event, accessKey) {
  if (!validAccessKey(accessKey)) return { state: 'configuration-required' };
  const fields = { ...emailPayload(event), access_key: accessKey.trim() };
  const claimed = await store.claim(event.id, { state: 'prepared', checkedAt: Date.now() });
  if (!claimed) return { state: 'previously-prepared' };
  return { state: 'ready', submission: { id: event.id, fields } };
}
