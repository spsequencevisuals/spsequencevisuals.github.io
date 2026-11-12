import { failure,json,readJson,requireOwner } from '../../../../lib/enquiries';
import { publishingConnection,saveOrganization } from '../../../../lib/publishing';
import { requireSameOrigin,RequestError } from '../../../../lib/request-data.mjs';
export async function GET(){try{await requireOwner();return json(await publishingConnection());}catch(error){if(error instanceof RequestError)return failure(error);return json({configured:true,connected:false,channels:[],organizations:[],message:error instanceof Error?error.message:'Unable to check the publishing connection.'},503);}}
export async function PUT(request:Request){try{await requireOwner();requireSameOrigin(request);const data=await readJson(request);if(typeof data.organizationId!=='string')return json({error:'Choose an organization.'},400);await saveOrganization(data.organizationId);return json(await publishingConnection());}catch(error){return failure(error);}}
