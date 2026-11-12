import { database } from './enquiries';
import { defaultProjects } from './portfolio-defaults.mjs';
import { escapeHtml, SOCIAL_LABELS, validateProject, validateProfiles } from './studio-data.mjs';
import { RequestError, isOwner } from './request-data.mjs';
import type { ChatGPTUser } from '../app/chatgpt-auth';

export type Asset = {id:string;storage_key:string;filename:string;mime:string;bytes:number;owner_id:string;created_at:number};
export type BehindScenes = {title:string;media:string;poster:string;duration:string;format:string;description:string};
export type ProjectVariant = BehindScenes & {id:string;label:string};
export type ProjectPreview = {media:string;sourceMedia:string;seconds:number};
export type Project = ReturnType<typeof validateProject> & {media:string;poster:string;type:'video'|'image';updatedAt?:number;behindScenes?:BehindScenes;variants?:ProjectVariant[];preview?:ProjectPreview};
type ProjectRow={id:string;status:string;sort_order:number;data_json:string;updated_at:number};

export function fallbackProjects(): Project[] {
 return defaultProjects.map((project,index)=>({...project,status:'published',sortOrder:index,mediaId:'',posterId:''}) as Project);
}
export async function projectsForOwner(): Promise<Project[]> {
 const rows=await database().prepare('SELECT id,status,sort_order,data_json,updated_at FROM portfolio_projects ORDER BY sort_order, created_at DESC LIMIT 500').all<ProjectRow>();
 const map=new Map(fallbackProjects().map(project=>[project.id,project]));
 for(const row of rows.results){const data=JSON.parse(row.data_json),bundled=map.get(row.id),behindScenes=bundled?.behindScenes,variants=bundled?.variants,preview=bundled?.preview&&data.media===bundled.preview.sourceMedia?bundled.preview:undefined;map.set(row.id,{...data,id:row.id,status:row.status,sortOrder:row.sort_order,updatedAt:row.updated_at,...(behindScenes?{behindScenes}:{}),...(variants?{variants}:{}),preview});}
 return [...map.values()].sort((a,b)=>a.sortOrder-b.sortOrder||a.title.localeCompare(b.title));
}
export async function publishedProjects(){return (await projectsForOwner()).filter(project=>project.status==='published');}
export async function findProject(id:string){return (await projectsForOwner()).find(project=>project.id===id);}
export async function assetById(id:string){return database().prepare('SELECT * FROM media_assets WHERE id=?').bind(id).first<Asset>();}
export async function saveProject(raw:unknown,actor:ChatGPTUser){
 if(!isOwner(actor))throw new RequestError('Sign in with an approved studio account.',403);
 const input=raw as Record<string,unknown>;const data=validateProject(input);
 const previous=await findProject(data.id);
 if(input.isNew&&previous)throw new RequestError('That project link already exists. Choose another link.');
 const original=defaultProjects.find(project=>project.id===data.id);
 const media=data.mediaId?await assetById(data.mediaId):null;
 const poster=data.posterId?await assetById(data.posterId):null;
 // One Site, one shared studio: approved accounts manage the same media library.
 // owner_id keeps the attribution of the original uploader.
 if(data.mediaId&&!media)throw new RequestError('Select an uploaded media file from the studio library.');
 if(data.posterId&&(!poster||!poster.mime.startsWith('image/')))throw new RequestError('Choose an image from the studio library for the cover.');
 if(!media&&!original)throw new RequestError('Upload or select a main image or video.');
 const type=media?(media.mime.startsWith('video/')?'video':'image'):(original!.type as 'video'|'image');
 const mediaUrl=media?'/media/'+media.id:original!.media;
 const posterUrl=poster?'/media/'+poster.id:type==='image'?mediaUrl:original?.poster||'/assets/hero.webp';
 const behindScenes=original?.behindScenes;
 const variants=original?.variants;
 const preview=original?.preview?.sourceMedia===mediaUrl?original.preview:undefined;
 const project:Project={...data,type,media:mediaUrl,poster:posterUrl,...(behindScenes?{behindScenes}:{}),...(variants?{variants}:{}),...(preview?{preview}:{})};const now=Date.now();
 await database().prepare('INSERT INTO portfolio_projects (id,title,status,sort_order,data_json,media_id,poster_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,sort_order=excluded.sort_order,data_json=excluded.data_json,media_id=excluded.media_id,poster_id=excluded.poster_id,updated_at=excluded.updated_at').bind(data.id,data.title,data.status,data.sortOrder,JSON.stringify(project),data.mediaId||null,data.posterId||null,now,now).run();
 return {...project,updatedAt:now};
}
export async function socialProfiles():Promise<Record<string,string>>{
 const row=await database().prepare('SELECT value FROM studio_settings WHERE key=?').bind('social_profiles').first<{value:string}>();
 return validateProfiles(row?JSON.parse(row.value):{}) as Record<string,string>;
}
export function socialMarkup(profiles:Record<string,string>){
 const links=Object.entries(profiles).filter(([,value])=>value).map(([field,value])=>`<a href="${escapeHtml(field==='whatsapp'?'https://wa.me/'+value:value)}" target="_blank" rel="noopener noreferrer">${escapeHtml((SOCIAL_LABELS as Record<string,string>)[field])}<span aria-hidden="true">↗</span></a>`).join('');
 return links?`<nav class="social-profile-links" aria-label="SPSequence Visuals social profiles">${links}</nav>`:'';
}
export function safeJson(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
