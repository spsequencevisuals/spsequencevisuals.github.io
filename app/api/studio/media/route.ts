import { env } from 'cloudflare:workers';
import { database,failure,json,requireOwner } from '../../../../lib/enquiries';
import { Asset } from '../../../../lib/portfolio';
import { RequestError,requireSameOrigin } from '../../../../lib/request-data.mjs';
import { MAX_MEDIA_BYTES,MEDIA_MIMES,hasMediaSignature } from '../../../../lib/studio-data.mjs';
export async function GET(request:Request){try{await requireOwner();const before=Number(new URL(request.url).searchParams.get('before')||Date.now()+1);if(!Number.isSafeInteger(before))throw new RequestError('Invalid media page.');const data=await database().prepare('SELECT id,filename,mime,bytes,created_at FROM media_assets WHERE created_at < ? ORDER BY created_at DESC LIMIT 101').bind(before).all<Asset>();const assets=data.results.slice(0,100).map(asset=>({...asset,url:'/media/'+asset.id}));return json({assets,nextCursor:data.results.length>100?assets[assets.length-1].created_at:null});}catch(error){return failure(error);}}
export async function POST(request:Request){
 let key:string|undefined;
 try{
  const owner=await requireOwner();requireSameOrigin(request);if(!env.BUCKET)throw new RequestError('Media uploads are not available yet. Please try again shortly.',503);
  const mime=(request.headers.get('content-type')||'').split(';')[0].toLowerCase();if(!MEDIA_MIMES.includes(mime))throw new RequestError('Use MP4, WebM, JPEG, PNG or WebP files.');
  const length=Number(request.headers.get('content-length'));if(!Number.isSafeInteger(length)||length<=0||length>MAX_MEDIA_BYTES)throw new RequestError('Choose a non-empty file up to 100 MB.',413);
  let filename;try{filename=decodeURIComponent(request.headers.get('x-file-name')||'upload');}catch{throw new RequestError('Please rename the file and try again.');}
  filename=filename.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,200)||'upload';
  if(!request.body)throw new RequestError('Please select a file.');
  const id=crypto.randomUUID();key='portfolio/'+id;
  const stored=await env.BUCKET.put(key,request.body,{httpMetadata:{contentType:mime}});
  if(!stored||stored.size!==length)throw new RequestError('The upload was interrupted. Please try again.',400);
  const head=await env.BUCKET.get(key,{range:{offset:0,length:32}});if(!head||!hasMediaSignature(mime,new Uint8Array(await head.arrayBuffer())))throw new RequestError('The file does not match its image or video format. Please export it again.');
  const now=Date.now();await database().prepare('INSERT INTO media_assets (id,storage_key,filename,mime,bytes,owner_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,key,filename,mime,stored.size,owner.userId,now).run();key=undefined;
  return json({asset:{id,filename,mime,bytes:stored.size,created_at:now,url:'/media/'+id}},201);
 }catch(error){if(key&&env.BUCKET)await env.BUCKET.delete(key).catch(()=>{});return failure(error);}
}
