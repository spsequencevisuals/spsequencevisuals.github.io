import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const secretNames = ['SESSION_SECRET', 'GITHUB_CLIENT_SECRET'];

export function ownerSecrets(env) {
  const secrets = {};
  for (const name of secretNames) {
    if (env[name] === undefined) continue;
    const value = env[name];
    const minimum = name === 'SESSION_SECRET' ? 32 : 20;
    if (typeof value !== 'string' || value.length < minimum || value.length > 2000 || /\s/.test(value)) {
      throw new Error(`Invalid ${name}; check the encrypted build setting.`);
    }
    secrets[name] = value;
  }
  return secrets;
}

export function syncOwnerSecrets({ env = process.env, run = spawnSync, log = console.log } = {}) {
  const secrets = ownerSecrets(env);
  const names = Object.keys(secrets);
  if (!names.length) {
    log('No Owner Studio build secrets supplied; existing runtime secrets are preserved.');
    return;
  }
  const childEnv = {
    ...env,
    CI: 'true',
    WRANGLER_LOG: 'error',
    WRANGLER_LOG_SANITIZE: 'true',
    WRANGLER_WRITE_LOGS: 'false',
    WRANGLER_SEND_METRICS: 'false',
  };
  for (const name of secretNames) delete childEnv[name];
  const result = run('npx', ['--no-install', 'wrangler', 'secret', 'bulk'], {
    cwd: dirname(fileURLToPath(import.meta.url)),
    env: childEnv,
    input: JSON.stringify(secrets),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  // Do not forward CLI output: an unexpected upstream error must never print key values.
  if (result.error || result.status !== 0) {
    throw new Error('Cloudflare could not save Owner Studio runtime secrets. Check the build token and encrypted settings.');
  }
  log(`Saved encrypted runtime secrets: ${names.join(', ')}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    syncOwnerSecrets();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
