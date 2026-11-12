import { env } from 'cloudflare:workers';
import { database,digest } from './enquiries';
import { assetById,findProject } from './portfolio';
import { RequestError } from './request-data.mjs';
import { PUBLISH_SERVICES,validateDraft } from './studio-data.mjs';
import { BufferError,createBufferClient,CREATE_VIDEO_POST,parsePostResult,videoPostInput } from './buffer-client.mjs';
type Organization={id:string;name:string};
export type Channel={id:string;name:string;displayName:string|null;service:string;descriptor:string;isDisconnected:boolean;isLocked:boolean;isQueuePaused:boolean;allowedActions:string[];externalLink?:string};
type Draft=ReturnType<typeof validateDraft>;
export type DraftRow={id:string;title:string;data_json:string;state:string;created_at:number;updated_at:number};
export type Dispatch={id:string;draft_id:string;channel_id:string;service:string;state:string;provider_post_id:string|null;external_link:string|null;message:string;created_at:number;updated_at:number};
const client=()=>{if(!env.BUFFER_API_KEY)throw new RequestError('Connect the publishing service before sending a release.',409);return createBufferClient(env.BUFFER_API_KEY);};
export async function publishingConnection(){
 if(!env.BUFFER_API_KEY)return {configured:false,connected:false,provider:'Buffer',organizations:[] as Organization[],organizationId:'',channels:[] as Channel[],message:'No publishing connection yet. You can upload videos and save drafts now.'};
 const query=client();const account=await query('query { account { organizations { id name } } }');const organizations=(account.account?.organizations||[]) as Organization[];
 const saved=await database().prepare('SELECT value FROM studio_settings WHERE key=?').bind('buffer_organization').first<{value:string}>();
 const organizationId=env.BUFFER_ORGANIZATION_ID||saved?.value||(organizations.length===1?organizations[0].id:'');
 if(!organizationId||!organizations.some(org=>org.id===organizationId))return {configured:true,connected:false,provider:'Buffer',organizations,organizationId:'',channels:[] as Channel[],message:'Choose the Buffer organization for this studio.'};
 const result=await query('query GetChannels($id:OrganizationId!){channels(input:{organizationId:$id}){id name displayName service descriptor externalLink isDisconnected isLocked isQueuePaused allowedActions}}',{id:organizationId});
 const channels=(result.channels as Channel[]||[]).filter(channel=>PUBLISH_SERVICES.includes(channel.service));
 return {configured:true,connected:true,provider:'Buffer',organizations,organizationId,channels,message:channels.length?'Choose the connected accounts for your release.':'Connect your social channels in Buffer, then refresh.'};
}
export async function saveOrganization(organizationId:string){
 if(env.BUFFER_ORGANIZATION_ID&&organizationId!==env.BUFFER_ORGANIZATION_ID)throw new RequestError('The publishing organization is managed in secure site settings.');
 const query=client();const data=await query('query { account { organizations { id name } } }');if(!data.account?.organizations?.some((org:Organization)=>org.id===organizationId))throw new RequestError('Choose an organization connected to your Buffer account.');
 await database().prepare('INSERT INTO studio_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('buffer_organization',organizationId,Date.now()).run();
}
export async function draftsForOwner(){const rows=await database().prepare('SELECT * FROM social_drafts ORDER BY updated_at DESC LIMIT 200').all<DraftRow>();return rows.results.map(row=>({...JSON.parse(row.data_json),state:row.state,createdAt:row.created_at,updatedAt:row.updated_at}));}
export async function saveSocialDraft(raw:unknown){
 const draft=validateDraft(raw);const previous=await database().prepare('SELECT state FROM social_drafts WHERE id=?').bind(draft.id).first<{state:string}>();if(previous&&previous.state!=='draft')throw new RequestError('This release has already been sent. Create a new draft to prepare another release.',409);
 if(draft.projectId){const project=await findProject(draft.projectId);if(!project||project.type!=='video')throw new RequestError('Choose a video project.');}
 if(draft.mediaId){const asset=await assetById(draft.mediaId);if(!asset?.mime.startsWith('video/'))throw new RequestError('Choose an uploaded video.');}
 const now=Date.now();const saved=await database().prepare("INSERT INTO social_drafts (id,title,data_json,state,created_at,updated_at) VALUES (?,?,?,'draft',?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data_json=excluded.data_json,updated_at=excluded.updated_at WHERE social_drafts.state='draft'").bind(draft.id,draft.title,JSON.stringify(draft),now,now).run();if(!saved.meta.changes)throw new RequestError('This release has already been sent. Create a new draft to prepare another release.',409);return {...draft,state:'draft',updatedAt:now};
}
export async function dispatchesForDraft(id:string){return (await database().prepare('SELECT * FROM social_dispatches WHERE draft_id=? ORDER BY created_at').bind(id).all<Dispatch>()).results;}
async function mediaUrl(draft:Draft,request:Request){
 if(draft.externalUrl)return draft.externalUrl;
 let path='';if(draft.mediaId){const asset=await assetById(draft.mediaId);if(!asset?.mime.startsWith('video/'))throw new RequestError('Choose a video file.');path='/media/'+asset.id;}
 else if(draft.projectId){const project=await findProject(draft.projectId);if(project?.type==='video')path=project.media;}
 if(!path)throw new RequestError('Choose a video or add a direct public video URL.');
 const url=new URL(path,request.url);if(url.protocol!=='https:')throw new RequestError('Social publishing needs a public HTTPS video URL.');
 let response;try{response=await fetch(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(10000)});}catch{throw new RequestError('The publishing service needs a public video link. This file could not be reached without sign-in.');}
 if(!response.ok||!response.headers.get('content-type')?.startsWith('video/'))throw new RequestError('This video is not public without sign-in. Use a direct public video URL, or publish the portfolio project and launch your site publicly first.');
 return url.href;
}
export async function publishDraft(id:string,request:Request){
 const row=await database().prepare('SELECT * FROM social_drafts WHERE id=?').bind(id).first<DraftRow>();if(!row)throw new RequestError('Save the draft before sending it.',404);
 if(row.state!=='draft')return {submitted:true,results:await dispatchesForDraft(id)};
 const draft=validateDraft(JSON.parse(row.data_json));const connection=await publishingConnection();if(!connection.connected)throw new RequestError(connection.message,409);
 if(!draft.channelIds.length)throw new RequestError('Select at least one connected account.');
 const channels=draft.channelIds.map(id=>connection.channels.find(channel=>channel.id===id));
 if(channels.some(channel=>!channel||channel.isDisconnected||channel.isLocked||!channel.allowedActions.includes('scheduleUpdates')))throw new RequestError('One or more selected accounts need to be reconnected or do not allow publishing. Refresh connections and choose available accounts.');
 if(!draft.caption)throw new RequestError('Add a caption before sending your release.');
 const url=await mediaUrl(draft,request);const query=client();const now=Date.now();
 // Claim the release once before any external write. An interrupted call is never replayed.
 const claim=await database().prepare("UPDATE social_drafts SET state='submitted',updated_at=? WHERE id=? AND state='draft' AND updated_at=?").bind(now,id,row.updated_at).run();
 if(!claim.meta.changes){const latest=await database().prepare('SELECT state FROM social_drafts WHERE id=?').bind(id).first<{state:string}>();if(latest?.state==='submitted')return {submitted:true,results:await dispatchesForDraft(id)};throw new RequestError('This draft changed during review. Review it again before sending.',409);}
 await Promise.all(channels.map(async(channel)=>{
  const target=channel!;const attempt=await digest(id+'|'+target.id);await database().prepare("INSERT INTO social_dispatches (id,draft_id,channel_id,service,state,message,created_at,updated_at) VALUES (?,?,?,?,'sending','',?,?) ON CONFLICT(id) DO NOTHING").bind(attempt,id,target.id,target.service,now,now).run();
  try{const post=parsePostResult(await query(CREATE_VIDEO_POST,{input:videoPostInput(draft,target,url)},true));const state=String(post.status);await database().prepare('UPDATE social_dispatches SET state=?,provider_post_id=?,external_link=?,message=?,updated_at=? WHERE id=?').bind(state,String(post.id),post.externalLink||null,target.service==='tiktok'?'Saved in Buffer. Finish the TikTok post, privacy and disclosures before publishing.':'',Date.now(),attempt).run();}
  catch(error){const ambiguous=error instanceof BufferError&&error.ambiguous;await database().prepare('UPDATE social_dispatches SET state=?,message=?,updated_at=? WHERE id=?').bind(ambiguous?'unverified':'error',error instanceof Error?error.message:'Publishing result could not be verified.',Date.now(),attempt).run();}
 }));
 return {submitted:true,results:await dispatchesForDraft(id)};
}
export async function refreshDraftResults(id:string){
 const records=await dispatchesForDraft(id);const known=records.filter(record=>record.provider_post_id);if(!known.length)throw new RequestError('No confirmed provider post IDs are available yet. Check Buffer before creating another release.',409);const query=client();let failed=0;
 await Promise.all(known.map(async record=>{try{const result=await query('query PostStatus($id:PostId!){post(input:{id:$id}){id status externalLink}}',{id:record.provider_post_id});if(!result.post?.status)throw new Error('Missing status');await database().prepare('UPDATE social_dispatches SET state=?,external_link=?,updated_at=? WHERE id=?').bind(result.post.status,result.post.externalLink||null,Date.now(),record.id).run();}catch{failed++;}}));
 if(failed)throw new RequestError('Some results could not be refreshed. Previous results are retained; please check Buffer or try Refresh again. No new posts were created.',503);
 return dispatchesForDraft(id);
}
