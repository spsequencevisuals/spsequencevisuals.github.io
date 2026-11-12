/* Web3Forms publicly supports browser delivery; no email-provider cookies or
   mailbox credentials are sent. Outcomes never replace the saved order receipt. */
(function (root) {
  'use strict';
  const outcomes = new Map();
  function send(submission, fetcher = root.fetch.bind(root), timeoutMs = 20000) {
    if (!submission || typeof submission.id !== 'string' || !/^(?:test:)?[a-f0-9-]{36}$/i.test(submission.id) || !submission.fields || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(submission.fields.access_key || '')) return Promise.resolve({ state: 'configuration-required' });
    if (outcomes.has(submission.id)) return outcomes.get(submission.id);
    const task = deliver(submission.fields, fetcher, timeoutMs);
    outcomes.set(submission.id, task);
    if (outcomes.size > 64) outcomes.delete(outcomes.keys().next().value);
    return task;
  }
  async function deliver(fields, fetcher, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher('https://api.web3forms.com/submit', {
        method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(fields),
      });
      if (response.status === 429) return { state: 'failed', reason: 'rate-limit' };
      if (response.status >= 500 || (response.status >= 300 && response.status < 400)) return { state: 'unknown', reason: 'service-response' };
      if (!response.ok) return { state: 'failed', reason: 'service-rejected' };
      const reader = response.body?.getReader();
      if (!reader) return { state: 'unknown', reason: 'empty-response' };
      let bytes = 0, text = '';
      const decoder = new TextDecoder();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 65536) { await reader.cancel(); return { state: 'unknown', reason: 'unexpected-response' }; }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      let result;
      try { result = JSON.parse(text); } catch { return { state: 'unknown', reason: 'unexpected-response' }; }
      if (result?.success === true) return { state: 'accepted' };
      if (result?.success === false) return { state: 'failed', reason: 'service-rejected' };
      return { state: 'unknown', reason: 'unexpected-response' };
    } catch { return { state: 'unknown', reason: controller.signal.aborted ? 'timeout' : 'network' }; }
    finally { clearTimeout(timer); }
  }
  root.SPRequestEmail = Object.freeze({ send });
})(typeof window === 'undefined' ? globalThis : window);
