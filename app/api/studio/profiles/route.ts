import { database,failure,json,readJson,requireOwner } from '../../../../lib/enquiries';
import { socialProfiles } from '../../../../lib/portfolio';
import { requireSameOrigin } from '../../../../lib/request-data.mjs';
import { validateProfiles } from '../../../../lib/studio-data.mjs';
export async function GET(){try{await requireOwner();return json({profiles:await socialProfiles()});}catch(error){return failure(error);}}
export async function PUT(request:Request){try{await requireOwner();requireSameOrigin(request);const profiles=validateProfiles(await readJson(request));await database().prepare('INSERT INTO studio_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('social_profiles',JSON.stringify(profiles),Date.now()).run();return json({saved:true,profiles});}catch(error){return failure(error);}}
