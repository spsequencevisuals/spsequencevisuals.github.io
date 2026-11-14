import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,posix} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {defaultProjects} from '../../lib/portfolio-defaults.mjs';
import manifest from '../../lib/bundled-media-manifest.json' with {type:'json'};
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),out=join(here,'static'),gen=join(here,'generated');
rmSync(out,{recursive:true,force:true});rmSync(gen,{recursive:true,force:true});mkdirSync(join(out,'assets'),{recursive:true});mkdirSync(gen,{recursive:true});
const write=(name,text)=>{const file=join(gen,name);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,text);};
const modules=['lib/request-data.mjs','lib/request-security.mjs','lib/studio-data.mjs','lib/youtube.mjs','lib/buffer-client.mjs','lib/enquiries.ts','lib/portfolio.ts','lib/publishing.ts','lib/project-page.ts',...['projects','media','profiles','publishing','drafts','publish'].map(x=>'app/api/studio/'+x+'/route.ts'),'app/media/[id]/route.ts'];
for(const name of modules){
 let text=readFileSync(join(root,name),'utf8');text=text.replace(/import \{ Asset \} from [^;]+;\n/,'');if(name.endsWith('.ts'))text=stripTypeScriptTypes(text);
 const folder=posix.dirname(name);
 text=text.replace(/from (['"])([^'"]+)\1/g,(match,q,path)=>{
  if(path==='cloudflare:workers'){let rel=posix.relative(folder,'context.mjs');if(!rel.startsWith('.'))rel='./'+rel;return 'from '+q+rel+q;}
  if(!path.startsWith('.'))return match;let next=path;if(!/\.(mjs|json)$/.test(next))next=next.replace(/\.ts$/,'')+'.mjs';return 'from '+q+next+q;
 });
 write(name.replace(/\.ts$/,'.mjs'),text);
}
write('context.mjs',"export {env} from '../context.mjs';\n");
write('app/chatgpt-auth.mjs',"import {currentOwner} from '../../context.mjs'; export async function getChatGPTUser(){return currentOwner();}\n");
const origin='https://spsequencevisuals.github.io';
const rewrite=value=>typeof value==='string'?value.startsWith('/portfolio-media/')?origin+'/assets/media-files/'+manifest[value.slice(17)].filename:value.startsWith('/assets/')?origin+value:value:Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)])):value;
write('lib/portfolio-defaults.mjs','export const defaultProjects='+JSON.stringify(rewrite(defaultProjects))+';\n');
for(const name of ['studio.css','studio-thumbnails.mjs','share.css','video-playback.js','youtube-player.js','project-share.js','photo-gallery.js','photo-gallery.css'])cpSync(join(root,'public',name),join(out,name));
for(const name of ['sp-sequence-logo.png','sp-sequence-cover.png','hero.webp','mark.svg','studio-sans.woff2','studio-sans-bold.woff2'])cpSync(join(root,'public/assets',name),join(out,'assets',name));
let html=readFileSync(join(root,'site/studio.html'),'utf8').replace('<a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a>','<button class="text-link" type="button" id="owner-signout">Sign out</button>').replaceAll('href="/studio-inbox#email-alerts"','href="https://mail.google.com/mail/" target="_blank" rel="noopener"').replaceAll('href="/studio-inbox"','href="https://mail.google.com/mail/" target="_blank" rel="noopener"').replace('Manage email alerts ↗','Open brand Gmail ↗').replace('Open client requests','Open brand inbox').replace('Client requests <span','Brand inbox <span').replace('up to 100 MB per file','up to 500 MB per file · uploaded in smaller parts').replace('Project and review links are permanent. Clients can open them without signing in once you launch your site publicly.','Published projects appear on your GitHub portfolio automatically. Drafts remain private.').replace('Saving a project to the portfolio keeps your website’s current audience. A private site still requires sign-in.','Choose “Show on portfolio” when this project is ready for clients.').replace('Have the connection key added to this website’s secure settings.','Add the connection key to your personal Cloudflare Worker secrets as BUFFER_API_KEY.').replaceAll('href="/"','href="'+origin+'/"').replaceAll('href="/#contact"','href="'+origin+'/#contact"');
writeFileSync(join(out,'studio.html'),html);
let js=readFileSync(join(root,'public/studio.js'),'utf8');
const start=js.indexOf(' function uploadFile('),end=js.indexOf(" $('library-files').addEventListener",start);if(start<0||end<0)throw new Error('Studio upload hook changed.');
js=js.slice(0,start)+readFileSync(join(here,'upload-client.js'),'utf8')+'\n'+js.slice(end);
const summary=js.indexOf(' let summaryBusy=false;'),boot=js.indexOf(' async function boot()',summary);if(summary<0||boot<0)throw new Error('Studio summary hook changed.');
js=js.slice(0,summary)+" function loadRequestSummary(){ $('request-arrivals-status').textContent='Client enquiries arrive at spsequencevisuals@gmail.com.'; $('studio-email-status').textContent='Open your brand Gmail to read requests and reply.'; $('nav-request-count').hidden=true;}\n $('owner-signout').addEventListener('click',async()=>{await fetch('/auth/logout',{method:'POST',redirect:'manual'});location.assign('/studio');});\n"+js.slice(boot);
js=js.replace("  $('project-count').textContent=String(projects.length).padStart(2,'0');","  $('project-count').textContent=String(projects.length).padStart(2,'0'); message('portfolio-status',projects.length+' projects · '+projects.filter(project=>project.status==='published').length+' on the portfolio.');");
writeFileSync(join(out,'studio.js'),js);
mkdirSync(join(here,'migrations'),{recursive:true});writeFileSync(join(here,'migrations/0001_owner.sql'),readFileSync(join(root,'drizzle/0001_known_hairball.sql'),'utf8')+'\n'+readFileSync(join(here,'upload-schema.sql'),'utf8'));
console.log('Prepared independent owner studio assets. No credentials included.');

