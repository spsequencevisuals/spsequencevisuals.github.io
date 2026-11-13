import {context} from './context.mjs';
import {ownerFor,configured,sameOrigin,startSignIn,finishSignIn,signOut} from './auth.mjs';
import {startUpload,uploadPart,completeUpload,abortUpload} from './uploads.mjs';
import {publishedProjects,socialProfiles,findProject} from './generated/lib/portfolio.mjs';
import {projectPage} from './generated/lib/project-page.mjs';
import * as projects from './generated/app/api/studio/projects/route.mjs';
import * as media from './generated/app/api/studio/media/route.mjs';
import * as profiles from './generated/app/api/studio/profiles/route.mjs';
import * as publishing from './generated/app/api/studio/publishing/route.mjs';
import * as drafts from './generated/app/api/studio/drafts/route.mjs';
import * as publish from './generated/app/api/studio/publish/route.mjs';
import * as mediaFile from './generated/app/media/[id]/route.mjs';
const routes={projects,media,profiles,publishing,drafts,publish};
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const origin=env=>new URL(env.PUBLIC_SITE_URL||'https://spsequencevisuals.github.io').origin;
const rewrite=(value,base)=>typeof value==='string'&&(value.startsWith('/media/')||value.startsWith('/assets/'))?base+value:Array.isArray(value)?value.map(x=>rewrite(x,base)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v,base)])):value;
function gate(env){return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex,nofollow"><title>Owner studio · SP Sequence Visuals</title><link rel="stylesheet" href="/studio.css"><link rel="stylesheet" href="/theme-light.css" media="(prefers-color-scheme:light)"></head><body class="owner-studio"><main class="studio-shell"><div class="studio-welcome"><div><img src="/assets/sp-sequence-logo.png" width="240" alt="SP Sequence Visuals"><p class="eyebrow">YOUR PRIVATE OWNER STUDIO</p><h1>Your work.<br><em>Your own space.</em></h1><p>Upload work, curate the portfolio and prepare social releases.</p>'+(configured(env)?'<a class="button light" href="/auth/start">Continue with GitHub ↗</a>':'<p>Owner sign-in is awaiting its one-time personal account setup. Uploads and publishing remain locked.</p>')+'<p>Owner: spsequencevisuals</p><a class="text-link" href="'+origin(env)+'">← Public portfolio</a></div></div></main></body></html>';}
export async function handle(request,env){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/',owner=await ownerFor(request,env);
 return context.run({env,owner},async()=>{
  let response;
  try{
   if(path==='/health')response=json({service:'SP Sequence Visuals studio',signInReady:configured(env),storageReady:Boolean(env.DB&&env.BUCKET),publishingConfigured:Boolean(env.BUFFER_API_KEY)});
   else if(path==='/auth/start'&&request.method==='GET')response=await startSignIn(request,env);
   else if(path==='/auth/callback'&&request.method==='GET')response=await finishSignIn(request,env);
   else if(path==='/auth/logout'&&request.method==='POST')response=sameOrigin(request)?signOut():json({error:'Use your owner studio to sign out.'},403);
   else if(path==='/')response=new Response(null,{status:302,headers:{Location:'/studio'}});
   else if(path==='/studio'||path==='/studio.html')response=owner?await env.ASSETS.fetch(new Request(new URL('/studio.html',request.url))):new Response(gate(env),{headers:{'Content-Type':'text/html; charset=utf-8'}});
   else if(path==='/api/portfolio'&&request.method==='GET')response=json({projects:rewrite(await publishedProjects(),url.origin),profiles:await socialProfiles()});
   else if(path.startsWith('/api/studio/')){
    if(!owner)response=json({error:'Sign in with your SP Sequence Visuals GitHub account.'},401);
    else if(!['GET','HEAD'].includes(request.method)&&!sameOrigin(request))response=json({error:'Make this change from your owner studio.'},403);
    else if(path==='/api/studio/uploads'&&request.method==='POST')response=json(await startUpload(request,env,owner),201);
    else if(/^\/api\/studio\/uploads\/[a-f0-9-]+\/parts\/\d+$/.test(path)&&request.method==='PUT')response=json(await uploadPart(request,env,owner,path.split('/')[4],Number(path.split('/')[6])));
    else if(/^\/api\/studio\/uploads\/[a-f0-9-]+\/complete$/.test(path)&&request.method==='POST')response=json({asset:await completeUpload(env,owner,path.split('/')[4])},201);
    else if(/^\/api\/studio\/uploads\/[a-f0-9-]+$/.test(path)&&request.method==='DELETE'){await abortUpload(env,owner,path.split('/')[4]);response=json({cancelled:true});}
    else{const route=routes[path.split('/')[3]],handler=route?.[request.method];response=handler?await handler(request):json({error:'Studio action not found.'},404);}
   }
   else if(/^\/media\/[a-f0-9-]+$/.test(path)&&['GET','HEAD'].includes(request.method))response=await mediaFile[request.method](request,{params:Promise.resolve({id:path.split('/')[2]})});
   else if(/^\/(work|view)\/[a-z0-9-]+$/.test(path)&&request.method==='GET'){
    const project=await findProject(path.split('/')[2]);response=project&&(project.status==='published'||owner)?new Response(projectPage(project,url.origin,path.startsWith('/view/')).replaceAll('href="/"','href="'+origin(env)+'/"').replaceAll('href="/#contact"','href="'+origin(env)+'/#contact"').replaceAll('href="/#work"','href="'+origin(env)+'/#work"'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}):new Response('Project not available.',{status:404});
   }else response=await env.ASSETS.fetch(request);
  }catch(error){response=json({error:error?.status?error.message:'The studio could not complete this request. Refresh and try again.'},error?.status||503);}
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; media-src 'self' blob: https:; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  if(/^\/(studio|auth|api\/studio)/.test(path)){headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex,nofollow');}
  if(path==='/api/portfolio'&&request.headers.get('origin')===origin(env)){headers.set('Access-Control-Allow-Origin',origin(env));headers.set('Vary','Origin');}
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 });
}
export default {fetch:handle};

