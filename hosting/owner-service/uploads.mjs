import {MEDIA_MIMES,hasMediaSignature,textField} from '../../lib/studio-data.mjs';
import {RequestError} from '../../lib/request-data.mjs';
import {readJson} from '../../lib/request-security.mjs';
export const PART_BYTES=8*1024*1024,MAX_UPLOAD_BYTES=500000000;
export async function startUpload(request,env,owner){
 const data=await readJson(request),size=Number(data.bytes);
 if(!MEDIA_MIMES.includes(data.mime))throw new RequestError('Use MP4, WebM, JPEG, PNG or WebP.');
 if(!Number.isSafeInteger(size)||size<=0||size>MAX_UPLOAD_BYTES)throw new RequestError('Choose a non-empty file up to 500 MB.',413);
 const active=await env.DB.prepare('SELECT COUNT(*) AS total FROM upload_sessions WHERE expires_at>?').bind(Date.now()).first();if(active.total>=5)throw new RequestError('Finish your current uploads first.',429);
 const total=await env.DB.prepare('SELECT (SELECT COALESCE(SUM(bytes),0) FROM media_assets)+(SELECT COALESCE(SUM(bytes),0) FROM upload_sessions WHERE expires_at>?) AS used').bind(Date.now()).first();if(total.used+size>8000000000)throw new RequestError('The studio storage budget is nearly full. Review storage before uploading.',413);
 const filename=textField(data.filename,'the filename',200,true).split(/[\\/]/).pop(),id=crypto.randomUUID(),storageKey='portfolio/'+id;
 const upload=await env.BUCKET.createMultipartUpload(storageKey,{httpMetadata:{contentType:data.mime}});
 try{await env.DB.prepare('INSERT INTO upload_sessions (id,storage_key,upload_id,filename,mime,bytes,owner_id,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,storageKey,upload.uploadId,filename,data.mime,size,owner.userId,Date.now()+86400000).run();}catch(error){await upload.abort();throw error;}
 return {id,partBytes:PART_BYTES,parts:Math.ceil(size/PART_BYTES)};
}
async function session(env,id,owner){const row=await env.DB.prepare('SELECT * FROM upload_sessions WHERE id=?').bind(id).first();if(!row||row.owner_id!==owner.userId||row.expires_at<Date.now())throw new RequestError('This upload expired. Select the file again.',404);return row;}
export async function uploadPart(request,env,owner,id,number){
 const row=await session(env,id,owner),count=Math.ceil(row.bytes/PART_BYTES);if(!Number.isSafeInteger(number)||number<1||number>count)throw new RequestError('Invalid upload part.');
 const expected=number===count?row.bytes-(number-1)*PART_BYTES:PART_BYTES,reader=request.body?.getReader();if(!reader)throw new RequestError('Empty upload part.');
 let total=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>expected){await reader.cancel();throw new RequestError('Upload part is too large.',413);}chunks.push(value);}
 if(total!==expected)throw new RequestError('Upload part was interrupted.');const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(number===1&&!hasMediaSignature(row.mime,bytes.slice(0,32)))throw new RequestError('File content does not match its image or video format.');
 const part=await env.BUCKET.resumeMultipartUpload(row.storage_key,row.upload_id).uploadPart(number,bytes);
 await env.DB.prepare('INSERT INTO upload_parts (session_id,part_number,etag,bytes) VALUES (?,?,?,?) ON CONFLICT(session_id,part_number) DO UPDATE SET etag=excluded.etag,bytes=excluded.bytes').bind(id,number,part.etag,bytes.length).run();return {partNumber:number};
}
export async function completeUpload(env,owner,id){
 const saved=await env.DB.prepare('SELECT id,filename,mime,bytes,created_at FROM media_assets WHERE id=? AND owner_id=?').bind(id,owner.userId).first();if(saved)return {...saved,url:'/media/'+id};
 const row=await session(env,id,owner),parts=(await env.DB.prepare('SELECT part_number,etag,bytes FROM upload_parts WHERE session_id=? ORDER BY part_number').bind(id).all()).results;
 if(parts.length!==Math.ceil(row.bytes/PART_BYTES)||parts.some((p,i)=>p.part_number!==i+1)||parts.reduce((n,p)=>n+p.bytes,0)!==row.bytes)throw new RequestError('Some upload parts are missing.',409);
 let object=await env.BUCKET.head(row.storage_key);if(!object)object=await env.BUCKET.resumeMultipartUpload(row.storage_key,row.upload_id).complete(parts.map(p=>({partNumber:p.part_number,etag:p.etag})));
 if(object.size!==row.bytes)throw new RequestError('Complete file size could not be confirmed.',409);
 const first=await env.BUCKET.get(row.storage_key,{range:{offset:0,length:32}});if(!first||!hasMediaSignature(row.mime,new Uint8Array(await first.arrayBuffer()))){await env.BUCKET.delete(row.storage_key);throw new RequestError('File format check failed.');}
 const now=Date.now();await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO media_assets (id,storage_key,filename,mime,bytes,owner_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,row.storage_key,row.filename,row.mime,row.bytes,owner.userId,now),env.DB.prepare('DELETE FROM upload_parts WHERE session_id=?').bind(id),env.DB.prepare('DELETE FROM upload_sessions WHERE id=?').bind(id)]);
 return {id,filename:row.filename,mime:row.mime,bytes:row.bytes,created_at:now,url:'/media/'+id};
}
export async function abortUpload(env,owner,id){const row=await session(env,id,owner);await env.BUCKET.resumeMultipartUpload(row.storage_key,row.upload_id).abort();await env.DB.batch([env.DB.prepare('DELETE FROM upload_parts WHERE session_id=?').bind(id),env.DB.prepare('DELETE FROM upload_sessions WHERE id=?').bind(id)]);}

