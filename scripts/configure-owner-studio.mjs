import {writeFileSync} from 'node:fs';import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const value=process.argv[2];if(!value)throw new Error('Usage: node scripts/configure-owner-studio.mjs https://YOUR-STUDIO.workers.dev');const url=new URL(value);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||url.port)throw new Error('Use the HTTPS root URL returned by the owner-service deployment.');
writeFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../hosting/studio-config.json'),JSON.stringify({apiBase:url.origin},null,2)+'\n');console.log('Updated the public studio address. Commit this configuration to publish it.');

