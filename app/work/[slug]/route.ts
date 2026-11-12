import { projectResponse } from '../../../lib/project-response';
export async function GET(request:Request,context:{params:Promise<{slug:string}>}){return projectResponse(request,(await context.params).slug);}
