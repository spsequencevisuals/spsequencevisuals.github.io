// Keep previous direct-video bookmarks working without a duplicate video file.
function redirect(request:Request) {
  return Response.redirect(new URL('/assets/smart-education-facilitators-v2.mp4',request.url),308);
}
export const GET=redirect;
export const HEAD=redirect;
