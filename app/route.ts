import html from "../site/index.html?raw";
import { fallbackProjects,publishedProjects,safeJson,socialMarkup,socialProfiles } from '../lib/portfolio';
import { escapeHtml } from '../lib/studio-data.mjs';

export async function GET() {
  let projects=fallbackProjects(),profiles:Record<string,string>={};
  try{projects=await publishedProjects();profiles=await socialProfiles();}catch(error){console.error('Portfolio data temporarily unavailable');}
  const content=html.replace('__PROJECT_DATA__',()=>safeJson(projects)).replaceAll('__PROJECT_COUNT__',String(projects.length).padStart(2,'0')).replace('__SOCIAL_PROFILES__',()=>socialMarkup(profiles)).replace('__WHATSAPP_BUTTON__',()=>profiles.whatsapp?`<a class="whatsapp-contact" href="https://wa.me/${escapeHtml(profiles.whatsapp)}" target="_blank" rel="noopener noreferrer" aria-label="Contact SP on WhatsApp">WhatsApp <span aria-hidden="true">↗</span></a>`:'');
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
