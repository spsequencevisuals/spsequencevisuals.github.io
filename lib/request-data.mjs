export const SERVICES = ['Video editing', 'Photography', 'Graphic design', 'Motion graphics', 'A little bit of everything'];
export const STATUSES = ['new', 'in-discussion', 'confirmed', 'completed', 'archived'];
export const BRAND_STUDIO_EMAIL = 'spsequencevisuals@gmail.com';
const STUDIO_ACCOUNTS = new Set([BRAND_STUDIO_EMAIL, 'digitaldreamshub2020@gmail.com']);

export function isOwner(user) {
  return Boolean(typeof user?.userId === 'string' && user.userId.trim() && typeof user?.email === 'string' && STUDIO_ACCOUNTS.has(user.email.trim().toLowerCase()));
}

export class RequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function field(value, label, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw new RequestError(`Please enter ${label}.`);
  const text = value.trim();
  if ((required && !text) || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new RequestError(`Please check ${label}${text.length > max ? ` (maximum ${max} characters)` : ''}.`);
  }
  return text;
}

export function validateRequest(data, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestError('Please check your request and try again.');
  if (data.website) throw new RequestError('Unable to submit this request. Please email SP directly.');
  const id = field(data.idempotencyKey, 'your request reference', 36, true);
  if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id)) throw new RequestError('Please refresh the page and try again.');
  if (!['order', 'session'].includes(data.intent)) throw new RequestError('Choose a service order or a session.');
  if (!SERVICES.includes(data.service)) throw new RequestError('Choose a service from the list.');
  const name = field(data.name, 'your name', 100, true);
  const email = field(data.email, 'your email address', 200, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestError('Please enter a valid email address.');
  const phone = field(data.phone, 'your phone number', 40);
  if (phone && !/^[+\d()\s.\-]{6,40}$/.test(phone)) throw new RequestError('Please check your phone number.');
  const preferredDate = field(data.preferredDate, 'your preferred date', 10, data.intent === 'session');
  if (preferredDate && (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || !Number.isFinite(Date.parse(preferredDate)) || new Date(preferredDate).toISOString().slice(0, 10) !== preferredDate || preferredDate < today)) throw new RequestError('Choose today or a future date.');
  const preferredTime = field(data.preferredTime, 'your preferred time', 5);
  if (preferredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) throw new RequestError('Choose a valid time.');
  const details = field(data.details, 'your project details', 5000, true);
  const budget = field(data.budget, 'your budget', 100);
  const referenceUrl = field(data.referenceUrl, 'your reference link', 1000);
  if (referenceUrl) {
    try {
      const url = new URL(referenceUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { throw new RequestError('Use a complete http or https reference link.'); }
  }
  return { id: id.toLowerCase(), intent: data.intent, service: data.service, name, email, phone, budget, preferredDate, preferredTime, details, referenceUrl };
}

export function requireSameOrigin(request) {
  const site = request.headers.get('sec-fetch-site');
  if (request.headers.get('origin') !== new URL(request.url).origin || (site && site !== 'same-origin' && site !== 'none')) throw new RequestError('Please send your request from the SPSequence Visuals website.', 403);
}
