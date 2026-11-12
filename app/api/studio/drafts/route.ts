import { failure,json,readJson,requireOwner } from '../../../../lib/enquiries';
import { draftsForOwner,saveSocialDraft } from '../../../../lib/publishing';
import { requireSameOrigin } from '../../../../lib/request-data.mjs';
export async function GET(){try{await requireOwner();return json({drafts:await draftsForOwner()});}catch(error){return failure(error);}}
export async function POST(request:Request){try{await requireOwner();requireSameOrigin(request);return json({draft:await saveSocialDraft(await readJson(request))},201);}catch(error){return failure(error);}}
