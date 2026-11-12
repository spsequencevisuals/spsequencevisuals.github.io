export class BufferError extends Error {constructor(message,ambiguous=false){super(message);this.ambiguous=ambiguous;}}
export const BUFFER_ENDPOINT='https://api.buffer.com';
export function createBufferClient(apiKey,fetcher=fetch){
 return async function(query,variables={},write=false){
  let response;try{response=await fetcher(BUFFER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(25000)});}catch{throw new BufferError('The publishing service did not confirm the result. Check Buffer before trying another post.',write);}
  let body;try{body=await response.json();}catch{throw new BufferError('The publishing service returned an unreadable result.',write);}
  if(!response.ok||body.errors?.length){const message=body.errors?.map(error=>error.message).join(' · ')||'Publishing service request failed (HTTP '+response.status+').';throw new BufferError(message.replaceAll(apiKey,'[redacted]').slice(0,500),write&&response.status>=500||write&&response.ok);}
  if(!body.data)throw new BufferError('The publishing service did not return a confirmed result.',write);
  if(typeof body.data.createPost?.message==='string')body.data.createPost.message=body.data.createPost.message.replaceAll(apiKey,'[redacted]');
  return body.data;
 };
}
export function videoPostInput(draft,channel,url){
 const tiktok=channel.service==='tiktok';const metadata={};
 if(channel.service==='facebook')metadata.facebook={type:'post'};
 if(channel.service==='instagram')metadata.instagram={type:'reel',shouldShareToFeed:true,isAiGenerated:Boolean(draft.isAiGenerated)};
 if(channel.service==='tiktok')metadata.tiktok={isAiGenerated:Boolean(draft.isAiGenerated)};
 if(channel.service==='twitter')metadata.twitter={isAiGenerated:Boolean(draft.isAiGenerated)};
 return {channelId:channel.id,text:draft.caption,assets:[{video:{url}}],schedulingType:'automatic',mode:tiktok?'addToQueue':'shareNow',needsApproval:false,saveToDraft:tiktok,...(Object.keys(metadata).length?{metadata}:{})};
}
export function parsePostResult(data){const value=data?.createPost;if(value?.post?.id&&value.post.status)return value.post;if(value?.message)throw new BufferError(String(value.message).slice(0,500));throw new BufferError('The publishing result could not be verified. Check Buffer before creating another post.',true);}
export const CREATE_VIDEO_POST=`mutation PublishVideo($input:CreatePostInput!){createPost(input:$input){__typename ... on PostActionSuccess{post{id status channelId dueAt sentAt externalLink}} ... on MutationError{message}}}`;
