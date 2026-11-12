import { RequestError } from './request-data.mjs';
export const CATEGORIES=['video','photo','design','motion'];
export const SOCIAL_FIELDS=['facebook','instagram','tiktok','linkedin','behance','x','whatsapp'];
export const SOCIAL_LABELS={facebook:'Facebook',instagram:'Instagram',tiktok:'TikTok',linkedin:'LinkedIn',behance:'Behance',x:'X',whatsapp:'WhatsApp'};
export const PUBLISH_SERVICES=['facebook','instagram','linkedin','twitter','tiktok'];
export const MAX_MEDIA_BYTES=100000000;
export const MEDIA_MIMES=['video/mp4','video/webm','image/jpeg','image/png','image/webp'];
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function textField(value,label,max=1000,required=false){
 if(value==null&&!required)return '';
 if(typeof value!=='string')throw new RequestError(`Please check ${label}.`);
 const result=value.trim();if((required&&!result)||result.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result))throw new RequestError(`Please check ${label} (maximum ${max} characters).`);
 return result;
}
export function validId(value){return typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(value);}
export function validateProfiles(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw new RequestError('Please check your profile links.');
 const allowed={facebook:['facebook.com','fb.com'],instagram:['instagram.com'],tiktok:['tiktok.com'],linkedin:['linkedin.com'],behance:['behance.net'],x:['x.com','twitter.com']};
 const result={};
 for(const field of SOCIAL_FIELDS){const raw=textField(data[field],SOCIAL_LABELS[field],1000);if(!raw){result[field]='';continue;}
  if(field==='whatsapp'){const number=raw.replace(/[\s().-]/g,'');if(!/^\+?[1-9]\d{7,14}$/.test(number))throw new RequestError('Use your WhatsApp number with its country code, for example +234 followed by your number without the first 0.');result[field]=number.replace(/^\+/,'');continue;}
  let url;try{url=new URL(/^[a-z]+:/i.test(raw)?raw:'https://'+raw);}catch{throw new RequestError(`Please enter a complete ${SOCIAL_LABELS[field]} profile link.`);}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname==='/'||!allowed[field].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw new RequestError(`Use a valid ${SOCIAL_LABELS[field]} profile URL.`);
  result[field]=url.href;
 }
 return result;
}
export function validateProject(data){
 if(!data||typeof data!=='object')throw new RequestError('Please check your project.');
 const id=textField(data.id,'the project link',80,true);if(!validId(id))throw new RequestError('Project links use lowercase letters, numbers and hyphens.');
 const title=textField(data.title,'the project title',140,true);
 const categories=Array.isArray(data.categories)?[...new Set(data.categories)]:[];
 if(!categories.length||categories.length>4||categories.some(x=>!CATEGORIES.includes(x)))throw new RequestError('Choose at least one portfolio category.');
 if(!['draft','published','archived'].includes(data.status))throw new RequestError('Choose a project status.');
 const tags=Array.isArray(data.tags)?data.tags.map(tag=>textField(tag,'a project tag',60,true)).slice(0,8):[];
 const sortOrder=Number(data.sortOrder??0);if(!Number.isSafeInteger(sortOrder)||Math.abs(sortOrder)>100000)throw new RequestError('Choose a valid display order.');
 const mediaId=textField(data.mediaId,'the media file',80);const posterId=textField(data.posterId,'the cover image',80);
 if((mediaId&&!validId(mediaId))||(posterId&&!validId(posterId)))throw new RequestError('Select a media file from your library.');
 return {id,title,categories,category:categories[0],status:data.status,sortOrder,tags,label:textField(data.label,'the project label',70)||'SELECTED WORK',description:textField(data.description,'the project description',5000,true),role:textField(data.role,'your role',200,true),format:textField(data.format,'the format',160),duration:textField(data.duration,'the duration',30),mediaId,posterId};
}
export function validateDraft(data){
 if(!data||typeof data!=='object')throw new RequestError('Please check the social post.');
 const id=textField(data.id,'the draft ID',80,true);if(!validId(id))throw new RequestError('Invalid draft reference.');
 const projectId=textField(data.projectId,'the selected project',80),mediaId=textField(data.mediaId,'the selected media',80);
 if((projectId&&!validId(projectId))||(mediaId&&!validId(mediaId)))throw new RequestError('Select media from your library.');
 const externalUrl=textField(data.externalUrl,'the public video URL',2000);
 if(externalUrl){let url;try{url=new URL(externalUrl);}catch{throw new RequestError('Use a complete public HTTPS video URL.');}if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)||/\.(local|internal|test)$/.test(url.hostname)||url.hostname.includes(':'))throw new RequestError('Use a direct public HTTPS video URL.');}
 const services=Array.isArray(data.services)?[...new Set(data.services)]:[];if(services.some(x=>!PUBLISH_SERVICES.includes(x)))throw new RequestError('Choose supported publishing channels.');
 const channelIds=Array.isArray(data.channelIds)?[...new Set(data.channelIds.map(x=>textField(x,'a channel',200,true)))].slice(0,10):[];
 return {id,title:textField(data.title,'the draft title',140,true),caption:textField(data.caption,'the caption',5000),projectId,mediaId,externalUrl,services,channelIds,isAiGenerated:Boolean(data.isAiGenerated)};
}
export function hasMediaSignature(mime,bytes){
 const ascii=(start,count)=>String.fromCharCode(...bytes.slice(start,start+count));
 if(mime==='video/mp4')return bytes.length>=12&&ascii(4,4)==='ftyp';
 if(mime==='video/webm')return bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
 if(mime==='image/jpeg')return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(mime==='image/png')return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
 if(mime==='image/webp')return ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP';
 return false;
}
export function parseRange(header,size){
 if(!header)return null;const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2]))throw new RequestError('Invalid video range.',416);
 let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));let end=match[1]?(match[2]?Number(match[2]):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw new RequestError('Invalid video range.',416);end=Math.min(end,size-1);return {offset:start,length:end-start+1};
}
