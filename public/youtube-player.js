'use strict';
// YouTube players join the same playback owner as uploaded videos.
window.SPYouTube=(()=>{
 const mounted=new Map();let apiReady;
 function videoId(value){
  let url;try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname,path=url.pathname.replace(/\/$/,'');let id;
  if(host==='youtu.be')id=path.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host))id=path==='/watch'?url.searchParams.get('v'):/^\/(?:shorts|live|embed)\/([^/]+)$/.exec(path)?.[1];
  else if(['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=/^\/embed\/([^/]+)$/.exec(path)?.[1];
  return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
 }
 function loadAPI(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(apiReady)return apiReady;
  apiReady=new Promise((resolve,reject)=>{
   const previous=window.onYouTubeIframeAPIReady;
   const timeout=setTimeout(()=>{apiReady=null;reject(new Error('YouTube could not connect.'));},20000);
   window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();resolve(window.YT);};
   const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
   script.onerror=()=>{clearTimeout(timeout);script.remove();apiReady=null;reject(new Error('YouTube could not connect.'));};document.head.append(script);
  });return apiReady;
 }
 function mount(host,{url,title='YouTube video',root=null,hoverTarget=null,previewSeconds=0,muted=true,loop=false,autoplay=true}={}){
  const id=videoId(url);if(!id)return null;if(mounted.has(host))return host;
  host.classList.add('youtube-player');host.setAttribute('aria-label',title);host.replaceChildren();
  const frame=document.createElement('div');frame.className='youtube-frame';
  const target=document.createElement('div');frame.append(target);host.append(frame);
  const fallback=document.createElement('p');fallback.className='youtube-fallback';fallback.hidden=true;
  const link=document.createElement('a');link.href='https://www.youtube.com/watch?v='+id;link.target='_blank';link.rel='noopener';link.textContent='Open this video on YouTube ↗';fallback.append(link);host.append(fallback);
  const state={paused:true,ended:false,muted,wanted:false,destroyed:false,player:null,ready:null,poll:null};
  const emit=name=>host.dispatchEvent(new Event(name));
  const stopped=(notify=true)=>{const wasPaused=state.paused;state.paused=true;if(notify&&!wasPaused)emit('pause');};
  Object.defineProperties(host,{paused:{get:()=>state.paused},ended:{get:()=>state.ended},muted:{get:()=>state.muted,set:value=>{state.muted=Boolean(value);if(state.player)(state.muted?state.player.mute():state.player.unMute());emit('volumechange');}},currentTime:{get:()=>state.player?.getCurrentTime?.()||0,set:value=>state.player?.seekTo?.(value,true)}});
  function ready(){
   if(state.ready)return state.ready;
   state.ready=loadAPI().then(YT=>new Promise((resolve,reject)=>{
    if(state.destroyed){resolve();return;}
    const timer=setTimeout(()=>reject(new Error('YouTube did not load.')),20000);
    state.player=new YT.Player(target,{host:'https://www.youtube-nocookie.com',videoId:id,width:'100%',height:'100%',playerVars:{playsinline:1,enablejsapi:1,origin:location.origin,rel:0,controls:1},events:{
     onReady:event=>{clearTimeout(timer);const iframe=event.target.getIframe();iframe.title=title;iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.setAttribute('allowfullscreen','');if(state.muted)event.target.mute();else event.target.unMute();resolve();},
     onStateChange:event=>{
      if(state.destroyed)return;
      if(event.data===1){state.wanted=true;state.paused=false;state.ended=false;fallback.hidden=true;emit('play');}
      else if(event.data===2)stopped();
      else if(event.data===0){state.paused=true;if(loop&&state.wanted){state.player.seekTo(0,true);window.SPVideoPlayback.play(host);}else{state.ended=true;state.wanted=false;emit('ended');}}
     },
     onAutoplayBlocked:()=>{state.wanted=false;stopped();},
     onError:()=>{clearTimeout(timer);fallback.hidden=false;state.wanted=false;stopped();resolve();}
    }});
   })).catch(error=>{fallback.hidden=false;state.ready=null;throw error;});
   return state.ready;
  }
  host.play=async()=>{
   state.wanted=true;state.paused=false;state.ended=false;
   try{await ready();if(state.destroyed||!state.wanted){stopped(false);return;}if(state.muted)state.player?.mute();else state.player?.unMute();state.player?.playVideo();}
   catch(error){state.wanted=false;stopped();throw error;}
  };
  host.pause=()=>{state.wanted=false;state.player?.pauseVideo();stopped();};
  state.poll=setInterval(()=>{if(!state.paused&&!state.destroyed)emit('timeupdate');},500);
  mounted.set(host,state);window.SPVideoPlayback.register(host,{root,hoverTarget,previewSeconds,autoplay});return host;
 }
 function destroy(host){const state=mounted.get(host);if(!state)return;state.destroyed=true;state.wanted=false;clearInterval(state.poll);window.SPVideoPlayback.unregister(host);state.player?.destroy();mounted.delete(host);}
 function destroyWithin(root){for(const host of mounted.keys())if(root.contains(host))destroy(host);}
 document.querySelectorAll('[data-youtube-url]').forEach(host=>mount(host,{url:host.dataset.youtubeUrl,title:host.dataset.youtubeTitle||'YouTube video'}));
 return {videoId,mount,destroy,destroyWithin};
})();
