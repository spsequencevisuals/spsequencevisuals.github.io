import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { database } from '../../../lib/enquiries';
import { assetById } from '../../../lib/portfolio';
import { isOwner,RequestError } from '../../../lib/request-data.mjs';
import { parseRange } from '../../../lib/studio-data.mjs';
async function serve(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const {id}=await context.params;const asset=await assetById(id);if(!asset||!env.BUCKET)return new Response('Media not found',{status:404});
  const publicUse=await database().prepare("SELECT id FROM portfolio_projects WHERE status='published' AND (media_id=? OR poster_id=?) LIMIT 1").bind(id,id).first();
  if(!publicUse&&!isOwner(await getChatGPTUser()))return new Response('Sign in to view this media.',{status:401,headers:{'Cache-Control':'no-store'}});
  const range=parseRange(request.headers.get('range'),asset.bytes);const object=await env.BUCKET.get(asset.storage_key,range?{range}:{});if(!object)return new Response('Media not found',{status:404});
  const headers=new Headers({'Content-Type':asset.mime,'Content-Length':String(range?.length??asset.bytes),'Accept-Ranges':'bytes','ETag':object.httpEtag,'X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,'Cache-Control':publicUse?'public, max-age=60':'private, no-store'});
  if(range)headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${asset.bytes}`);
  if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
  return new Response(object.body,{status:range?206:200,headers});
 }catch(error){return new Response('Unable to load media.',{status:error instanceof RequestError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=serve;
export const HEAD=serve;
