import { failure,json,readJson,requireOwner } from '../../../../lib/enquiries';
import { dispatchesForDraft,publishDraft,refreshDraftResults } from '../../../../lib/publishing';
import { requireSameOrigin } from '../../../../lib/request-data.mjs';
import { validId } from '../../../../lib/studio-data.mjs';
export async function GET(request:Request){try{await requireOwner();const id=new URL(request.url).searchParams.get('draft')||'';if(!validId(id))return json({error:'Select a draft.'},400);return json({results:await dispatchesForDraft(id)});}catch(error){return failure(error);}}
export async function POST(request:Request){try{await requireOwner();requireSameOrigin(request);const data=await readJson(request);if(!validId(data.id))return json({error:'Select a saved draft.'},400);if(data.refresh)return json({results:await refreshDraftResults(data.id)});if(data.confirmed!==true)return json({error:'Review the video, caption and selected accounts before sending.'},400);return json(await publishDraft(data.id,request));}catch(error){return failure(error);}}
