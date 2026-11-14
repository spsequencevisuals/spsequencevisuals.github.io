import {cpSync,mkdirSync,readFileSync,writeFileSync,openSync,writeSync,closeSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {defaultProjects} from '../lib/portfolio-defaults.mjs';
import {projectPage} from '../lib/project-page.ts';
import mediaManifest from '../lib/bundled-media-manifest.json' with {type:'json'};

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function normalizeBase(value='/'){
 if(!/^\/(?:[a-zA-Z0-9._-]+\/)*$/.test(value)||value.split('/').some(part=>part==='.'||part==='..'))throw new Error('Base must be / or a slash-delimited repository path such as /sp-sequence-visuals/.');
 return value;
}
export function exportPages({output=join(root,'out'),origin='https://example.invalid',base='/',formKey='bf6ccee8-370a-4e40-bb8d-42ffbb282165'}={}){
 base=normalizeBase(base);output=resolve(output);
 const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('Use a website origin without a path.');
 origin=url.origin;const siteOrigin=origin+base.slice(0,-1);
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(formKey))throw new Error('A valid public Web3Forms form identifier is required.');
 mkdirSync(output,{recursive:true});
 const excluded=/^(?:studio(?:\.js|\.css|-thumbnails\.mjs)|inbox(?:\.js|\.css)|email-qa(?:\.|-)|_headers$)/;
 cpSync(join(root,'public'),output,{recursive:true,filter:path=>{
  const rel=relative(join(root,'public'),path).replaceAll('\\','/');
  return !excluded.test(rel)&&rel!=='assets/media'&&!rel.startsWith('assets/media/');
 }});
 const restored=new Map();
 for(const [slug,asset] of Object.entries(mediaManifest)){
  const destination=join(output,'assets','media-files',asset.filename);mkdirSync(dirname(destination),{recursive:true});
  const fd=openSync(destination,'w'),hash=createHash('sha256');let total=0;
  try{for(const chunk of asset.chunks){const bytes=readFileSync(join(root,'public',chunk));writeSync(fd,bytes);hash.update(bytes);total+=bytes.length;}}finally{closeSync(fd);}
  if(total!==asset.totalBytes||hash.digest('hex')!==asset.etag)throw new Error('Bundled media integrity check failed: '+slug);
  restored.set('/portfolio-media/'+slug,'/assets/media-files/'+asset.filename);
 }
 const rewrite=value=>{
  if(typeof value==='string')return restored.get(value)||value;
  if(Array.isArray(value))return value.map(rewrite);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,rewrite(v)]));
  return value;
 };
 const projects=defaultProjects.map((p,index)=>({...rewrite(p),status:'published',sortOrder:index,mediaId:'',posterId:''}));
 const paths=/(\b(?:src|href|poster|content)=["'])\/(?!\/)|(["'`(])\/(?=assets\/|work\/|view\/|owner\/|studio-config\.js|studio-entry\.js|studio-live\.js|studio-project-redirect\.js|styles\.css|app\.js|features\.js|booking\.js|static-config\.js|request-email\.js|video-playback\.js|youtube-player\.js|project-share\.js|share\.css|manifest\.webmanifest|sw\.js|#|["'`])/g;
 const localize=text=>{
  text=text.replace(paths,(_match,html,code)=>(html||code)+base);
  // A ready-to-upload root site works with any personal username. Until an
  // actual origin is supplied, omit invented social URLs and copy real links
  // relative to the current browser origin instead.
  if(url.hostname.endsWith('.invalid'))text=text.replace(/<meta property="og:(?:url|image)" content="[^"]*">/g,'').replaceAll(origin,'');
  return text;
 };
 const safeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 let home=readFileSync(join(root,'site/index.html'),'utf8').replace('__PROJECT_DATA__',()=>safeJson(projects)).replaceAll('__PROJECT_COUNT__',String(projects.length).padStart(2,'0')).replace('__SOCIAL_PROFILES__','').replace('__WHATSAPP_BUTTON__','');
 home=home.replaceAll('https://sp-sequence-visuals.digitaldreamshub2020.chatgpt.site',siteOrigin);
 home=home.replace(/<a href="\/studio(?:-inbox)?" target="_top">.*?<\/a>/g,'');
 home=home.replace('<a href="#top">Back to top','<a href="/owner/">Owner studio</a><a href="#top">Back to top');
 home=home.replace('<script src="/video-playback.js" defer></script>','<script src="/studio-config.js" defer></script><script src="/video-playback.js" defer></script>');
 home=home.replace('Your contact details and brief are saved privately and shared with SP by email to handle this request.','Your contact details and brief are sent to SP by email to handle this request.');
 home=home.replace('REQUEST RECEIVED','BRIEF SUBMITTED').replace('Safely received.<br><em>Thank you.</em>','Brief submitted.<br><em>Thank you.</em>');
 home=home.replace('<script src="/app.js" defer></script>','<script src="/static-config.js" defer></script><script src="/booking.js" defer></script><script src="/app.js" defer></script>');
 home=home.replace('<script src="/app.js" defer></script>','<script src="/app.js" defer></script><script src="/studio-live.js" defer></script>');
 writeFileSync(join(output,'index.html'),localize(home));
 writeFileSync(join(output,'404.html'),localize('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · SP Sequence Visuals</title><link rel="stylesheet" href="/share.css"><main class="work-main"><h1>This page has moved.</h1><p><a href="/">Explore SP Sequence Visuals →</a></p></main></html>'));
 const features=readFileSync(join(root,'public/features.js'),'utf8');const bookingStart=features.indexOf('function initializeBooking(){'),bookingEnd=features.indexOf("document.addEventListener('click',event=>{const button=event.target.closest('[data-copy-project]')",bookingStart);
 if(bookingStart<0||bookingEnd<0)throw new Error('The booking section changed; update the static export before deploying.');
 writeFileSync(join(output,'features.js'),localize(features.slice(0,bookingStart)+features.slice(bookingEnd)));
 writeFileSync(join(output,'booking.js'),readFileSync(join(root,'hosting/github-pages/booking.js'),'utf8'));
 writeFileSync(join(output,'static-config.js'),'window.SPStaticConfig=Object.freeze('+JSON.stringify({formKey})+');\n');
 const configFile=join(root,'hosting/studio-config.json'),config=existsSync(configFile)?JSON.parse(readFileSync(configFile,'utf8')):{apiBase:''};
 if(config.apiBase){const backend=new URL(config.apiBase);if(backend.protocol!=='https:'||backend.pathname!=='/'||backend.search||backend.hash||backend.username||backend.password||backend.port)throw new Error('Use the HTTPS root URL of the owner service.');config.apiBase=backend.origin;}
 writeFileSync(join(output,'studio-config.js'),'window.SPStudioConfig=Object.freeze('+safeJson({apiBase:config.apiBase||''})+');\n');
 mkdirSync(join(output,'owner'),{recursive:true});writeFileSync(join(output,'owner/index.html'),localize('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex,nofollow"><title>Owner studio · SP Sequence Visuals</title><link rel="stylesheet" href="/share.css"><script src="/studio-config.js" defer></script><script src="/studio-entry.js" defer></script></head><body class="project-page"><header class="work-header"><a class="work-brand" href="/"><img src="/assets/sp-sequence-logo.png" alt="SP Sequence Visuals"></a><span>OWNER ACCESS</span></header><main class="work-main"><p class="eyebrow">YOUR PRIVATE WORKSPACE</p><h1>Your work.<br><em>Your own space.</em></h1><p id="owner-status">Checking your studio connection…</p><div class="work-actions"><a id="owner-link" hidden>Continue to owner sign-in ↗</a><a href="/">← Public portfolio</a></div></main></body></html>'));
 for(const name of ['styles.css','share.css','app.js','project-share.js','sw.js'])writeFileSync(join(output,name),localize(readFileSync(join(output,name),'utf8')));
 let sw=readFileSync(join(output,'sw.js'),'utf8');sw=sw.replace('sp-visuals-v21','sp-pages-v21-'+base.replaceAll('/','_'));sw=sw.replace("const SHELL=[","const SHELL=['"+base+"static-config.js','"+base+"booking.js',");writeFileSync(join(output,'sw.js'),sw);
 const manifest=JSON.parse(readFileSync(join(root,'public/manifest.webmanifest'),'utf8'));manifest.id=base;manifest.start_url=base;manifest.scope=base;manifest.icons.forEach(icon=>icon.src=base+icon.src.slice(1));manifest.shortcuts.forEach(shortcut=>shortcut.url=base+shortcut.url.slice(1));writeFileSync(join(output,'manifest.webmanifest'),JSON.stringify(manifest,null,2));
 for(const project of projects){for(const review of [false,true]){const dest=join(output,review?'view':'work',project.id,'index.html');mkdirSync(dirname(dest),{recursive:true});const live='<script src="/studio-config.js" defer></script><script id="live-project" type="application/json" data-id="'+project.id+'" data-review="'+review+'">{}</script><script src="/studio-project-redirect.js" defer></script>';writeFileSync(dest,localize(projectPage(project,siteOrigin,review).replace('</head>',live+'</head>').replaceAll(origin+'/assets/',origin+base+'assets/')));}}
 writeFileSync(join(output,'.nojekyll'),'');
 writeFileSync(join(output,'robots.txt'),'User-agent: *\nAllow: '+base+'\nDisallow: '+base+'view/\n'+(url.hostname.endsWith('.invalid')?'':'Sitemap: '+siteOrigin+'/sitemap.xml\n'));
 if(!url.hostname.endsWith('.invalid'))writeFileSync(join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+siteOrigin+'/</loc></url>'+projects.map(p=>'<url><loc>'+siteOrigin+'/work/'+p.id+'/</loc></url>').join('')+'</urlset>');
 const media=[];function inspect(dir){for(const name of readdirSync(dir)){const file=join(dir,name),stat=statSync(file);if(stat.isDirectory())inspect(file);else {if(stat.size>100*1024*1024)throw new Error('File exceeds GitHub’s 100 MiB limit: '+relative(output,file));if(/\.(mp4|webm)$/.test(file))media.push(relative(output,file));}}}inspect(output);
 return {output,projectCount:projects.length,mediaCount:media.length,base,origin};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){const key={'--out':'output','--origin':'origin','--base':'base','--form-key':'formKey'}[args[i]];if(!key||!args[i+1])throw new Error('Options: --out DIRECTORY --origin https://YOUR-USERNAME.github.io --base /REPOSITORY/');options[key]=args[i+1];}
 console.log(JSON.stringify(exportPages(options)));
}
