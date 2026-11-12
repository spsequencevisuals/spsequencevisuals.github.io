import { env } from 'cloudflare:workers';
import manifest from '../../../lib/bundled-media-manifest.json';
import { bundledVideoResponse } from '../../../lib/bundled-video.mjs';

async function serve(request:Request, context:{params:Promise<{slug:string}>}) {
  const {slug}=await context.params;
  const asset=Object.hasOwn(manifest,slug)?manifest[slug as keyof typeof manifest]:null;
  if(!asset)return new Response('Video not found.',{status:404});
  const assets=env.ASSETS;
  if(!assets)return new Response('Video temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});
  return bundledVideoResponse(request,asset,(path:string,headers:Record<string,string>)=>assets.fetch(new Request(new URL(path,request.url),{headers})));
}
export const GET=serve;
export const HEAD=serve;
