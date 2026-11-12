import { getChatGPTUser } from '../app/chatgpt-auth';
import { findProject } from './portfolio';
import { isOwner } from './request-data.mjs';
import { validId } from './studio-data.mjs';
import { projectPage } from './project-page';
export async function projectResponse(request:Request,id:string,review=false){
 try{const project=validId(id)?await findProject(id):null;if(!project||(project.status!=='published'&&!isOwner(await getChatGPTUser())))return new Response('Project not found.',{status:404,headers:{'Cache-Control':'no-store'}});return new Response(projectPage(project,new URL(request.url).origin,review),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':project.status==='published'?'no-cache':'no-store',...(review?{'X-Robots-Tag':'noindex, nofollow'}:{})}});}catch{return new Response('This project is temporarily unavailable. Please try again.',{status:503});}
}
