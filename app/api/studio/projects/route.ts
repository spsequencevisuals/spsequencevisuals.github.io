import { failure,json,readJson,requireOwner } from '../../../../lib/enquiries';
import { projectsForOwner,saveProject } from '../../../../lib/portfolio';
import { requireSameOrigin } from '../../../../lib/request-data.mjs';
export async function GET(){try{await requireOwner();return json({projects:await projectsForOwner()});}catch(error){return failure(error);}}
export async function POST(request:Request){try{const owner=await requireOwner();requireSameOrigin(request);return json({project:await saveProject(await readJson(request),owner)},201);}catch(error){return failure(error);}}
