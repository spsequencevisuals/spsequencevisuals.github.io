// Accept individual YouTube videos only; never turn arbitrary URLs into embeds.
export function youtubeVideoId(value){
 if(typeof value!=='string'||value.length>2000)return null;
 let url;try{url=new URL(value.trim());}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
 const host=url.hostname.toLowerCase(),path=url.pathname.replace(/\/$/,'');let id;
 if(host==='youtu.be')id=path.slice(1);
 else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)){
  if(path==='/watch')id=url.searchParams.get('v');
  else id=/^\/(?:shorts|live|embed)\/([^/]+)$/.exec(path)?.[1];
 }else if(['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=/^\/embed\/([^/]+)$/.exec(path)?.[1];
 return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
}
export function youtubeWatchUrl(id){return /^[A-Za-z0-9_-]{11}$/.test(String(id))?'https://www.youtube.com/watch?v='+id:'';}
export function youtubePoster(id){return /^[A-Za-z0-9_-]{11}$/.test(String(id))?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':'';}
