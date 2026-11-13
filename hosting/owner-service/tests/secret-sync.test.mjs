import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerSecrets, syncOwnerSecrets } from '../sync-secrets.mjs';

const session = 'test-session-key-'.repeat(4);
const github = 'test-github-key-'.repeat(3);

test('only the two approved credentials reach Wrangler, through stdin', () => {
  const logs = [];
  let call;
  syncOwnerSecrets({
    env: { SESSION_SECRET: session, GITHUB_CLIENT_SECRET: github, UNRELATED_SECRET: 'leave-out', CLOUDFLARE_API_TOKEN: 'build-token' },
    run: (...args) => { call = args; return { status: 0, stdout: github, stderr: session }; },
    log: value => logs.push(value),
  });
  assert.deepEqual(call.slice(0, 2), ['npx', ['--no-install', 'wrangler', 'secret', 'bulk']]);
  assert.deepEqual(JSON.parse(call[2].input), { SESSION_SECRET: session, GITHUB_CLIENT_SECRET: github });
  assert.equal(call[2].env.SESSION_SECRET, undefined);
  assert.equal(call[2].env.GITHUB_CLIENT_SECRET, undefined);
  assert.equal(call[2].env.CLOUDFLARE_API_TOKEN, 'build-token');
  assert.equal(call[2].env.WRANGLER_WRITE_LOGS, 'false');
  assert.equal(logs.join('').includes(session), false);
  assert.equal(logs.join('').includes(github), false);
});

test('partial setup preserves existing keys and empty setup never calls Wrangler', () => {
  assert.deepEqual(ownerSecrets({ SESSION_SECRET: session }), { SESSION_SECRET: session });
  let called = false;
  syncOwnerSecrets({ env: {}, run: () => { called = true; }, log: () => {} });
  assert.equal(called, false);
});

test('invalid keys and CLI failures are rejected without revealing values', () => {
  for (const value of ['', 'too-short', `${session}\n`]) {
    assert.throws(() => ownerSecrets({ SESSION_SECRET: value }), /Invalid SESSION_SECRET/);
  }
  assert.throws(() => syncOwnerSecrets({
    env: { SESSION_SECRET: session },
    run: () => ({ status: 1, stderr: session }),
    log: () => assert.fail('failed runs must not report success'),
  }), error => !error.message.includes(session) && /could not save/.test(error.message));
});
