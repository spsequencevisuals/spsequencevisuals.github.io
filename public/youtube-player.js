'use strict';
// YouTube players join the same playback owner as uploaded videos.
window.SPYouTube=(()=>{
 const mounted=new Map();let apiReady,choiceDialog,choiceHost,choiceTrigger,resumeChoice=false;
 function videoId(value){
  let url;try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname,path=url.pathname.replace(/\/$/,'');let id;
  if(host==='youtu.be')id=path.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host))id=path==='/watch'?url.searchParams.get('v'):/^\/(?:shorts|live|embed)\/([^/]+)$/.exec(path)?.[1];
  else if(['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=/^\/embed\/([^/]+)$/.exec(path)?.[1];
  return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
 }
 function watchUrl(url){const id=videoId(url);return id?'https://www.youtube.com/watch?v='+id:'';}
 function choose(host,{url,title='this video',trigger=null}={}){
  const destination=watchUrl(url);if(!destination)return null;
  const playback=mounted.get(host);if(playback?.player?.isMuted)playback.muted=playback.player.isMuted();
  if(!choiceDialog){
   choiceDialog=document.createElement('dialog');choiceDialog.className='youtube-choice';choiceDialog.setAttribute('aria-labelledby','youtube-choice-title');choiceDialog.setAttribute('aria-describedby','youtube-choice-description');
   choiceDialog.innerHTML='<p class="eyebrow">KEEP WATCHING, YOUR WAY</p><h2 id="youtube-choice-title">Where would you like to watch?</h2><p class="youtube-choice-project"></p><p id="youtube-choice-description">Keep watching here, or open this video on SP’s YouTube in a new tab.</p><div class="youtube-choice-actions"><button type="button" data-youtube-stay>Continue on this website</button><a data-youtube-leave target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></div><button type="button" class="youtube-choice-close" aria-label="Close watch options">×</button>';
   document.body.append(choiceDialog);
   choiceDialog.querySelector('[data-youtube-stay]').addEventListener('click',()=>{resumeChoice=true;choiceDialog.close();});
   choiceDialog.querySelector('[data-youtube-leave]').addEventListener('click',()=>{resumeChoice=false;choiceDialog.close();});
   choiceDialog.querySelector('.youtube-choice-close').addEventListener('click',()=>choiceDialog.close());
   choiceDialog.addEventListener('close',()=>{
    const previous=choiceHost,trigger=choiceTrigger,resume=resumeChoice;choiceHost=null;choiceTrigger=null;resumeChoice=false;
    if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');
    if(trigger?.isConnected)trigger.focus({preventScroll:true});
    if(resume&&previous?.isConnected&&mounted.has(previous))window.SPVideoPlayback.play(previous);
   });
  }
  choiceHost=host;choiceTrigger=trigger;resumeChoice=Boolean(host&&!host.paused);
  choiceDialog.querySelector('.youtube-choice-project').textContent=title;
  choiceDialog.querySelector('[data-youtube-leave]').href=destination;
  if(!choiceDialog.open)choiceDialog.showModal();
  document.body.classList.add('modal-open');window.SPVideoPlayback.pauseAll();
  return choiceDialog;
 }
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('[data-youtube-choice]');if(!link)return;
  const url=watchUrl(link.href);if(!url)return;
  event.preventDefault();const host=[...mounted.keys()].find(item=>mounted.get(item).url===url);
  choose(host,{url,title:link.dataset.youtubeTitle||mounted.get(host)?.title||'this video',trigger:link});
 });
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
 function mount(host,{url,title='YouTube video',poster='',root=null,previewSeconds=0,muted=true,loop=false,autoplay=true}={}){
  const id=videoId(url);if(!id)return null;if(mounted.has(host))return host;
  host.classList.add('youtube-player');host.setAttribute('aria-label',title);host.replaceChildren();
  const frame=document.createElement('div');frame.className='youtube-frame';
  const cover=document.createElement('img');cover.className='youtube-poster';cover.src=poster||'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';cover.alt='';
  const target=document.createElement('div');frame.append(target,cover);host.append(frame);
  const fallback=document.createElement('p');fallback.className='youtube-fallback';fallback.hidden=true;
  fallback.textContent='This video could not start here. Try the Play button, or choose where to watch below.';fallback.setAttribute('role','status');host.append(fallback);
  const actions=document.createElement('div');actions.className='youtube-actions';
  const watch=document.createElement('button');watch.type='button';watch.textContent='View video on YouTube ↗';watch.addEventListener('click',()=>choose(host,{url,title,trigger:watch}));actions.append(watch);host.append(actions);
  const state={url:watchUrl(url),title,paused:true,ended:false,muted,wanted:false,destroyed:false,player:null,ready:null,poll:null,prepare:null};
  const emit=name=>host.dispatchEvent(new Event(name));
  const stopped=(notify=true)=>{const wasPaused=state.paused;state.paused=true;if(notify&&!wasPaused)emit('pause');};
  Object.defineProperties(host,{paused:{get:()=>state.paused},ended:{get:()=>state.ended},muted:{get:()=>state.muted,set:value=>{state.muted=Boolean(value);if(state.player)(state.muted?state.player.mute():state.player.unMute());emit('volumechange');}},currentTime:{get:()=>state.player?.getCurrentTime?.()||0,set:value=>state.player?.seekTo?.(value,true)}});
  function ready(){
   if(state.ready)return state.ready;
   state.ready=loadAPI().then(YT=>new Promise((resolve,reject)=>{
    if(state.destroyed){resolve();return;}
    const timer=setTimeout(()=>reject(new Error('YouTube did not load.')),20000);
    state.player=new YT.Player(target,{host:'https://www.youtube-nocookie.com',videoId:id,width:'100%',height:'100%',playerVars:{playsinline:1,enablejsapi:1,origin:location.origin,rel:0,controls:1},events:{
     onReady:event=>{clearTimeout(timer);const iframe=event.target.getIframe();iframe.title=title;iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.setAttribute('allowfullscreen','');cover.hidden=true;if(state.muted)event.target.mute();else event.target.unMute();resolve();},
     onStateChange:event=>{
      if(state.destroyed)return;
      if(event.data===1){state.wanted=true;state.paused=false;state.ended=false;fallback.hidden=true;emit('play');}
      else if(event.data===2)stopped();
      else if(event.data===0){state.paused=true;if(loop&&state.wanted){state.player.seekTo(0,true);window.SPVideoPlayback.play(host);}else{state.ended=true;state.wanted=false;emit('ended');}}
     },
     onAutoplayBlocked:()=>{state.wanted=false;fallback.textContent='Tap Play to start this video. You can keep watching on this website.';fallback.hidden=false;stopped();},
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
  state.prepare=ready;mounted.set(host,state);window.SPVideoPlayback.register(host,{root,previewSeconds,autoplay});loadObserver?.observe(host);return host;
 }
 const loadObserver='IntersectionObserver' in window?new window.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){loadObserver.unobserve(entry.target);mounted.get(entry.target)?.prepare().catch(()=>{});}},{rootMargin:'400px 0px'}):null;
 function destroy(host){const state=mounted.get(host);if(!state)return;state.destroyed=true;state.wanted=false;clearInterval(state.poll);loadObserver?.unobserve(host);window.SPVideoPlayback.unregister(host);state.player?.destroy();mounted.delete(host);if(choiceHost===host&&choiceDialog?.open){resumeChoice=false;choiceDialog.close();}}
 function destroyWithin(root){for(const host of mounted.keys())if(root.contains(host))destroy(host);}
 document.querySelectorAll('[data-youtube-url]').forEach(host=>mount(host,{url:host.dataset.youtubeUrl,title:host.dataset.youtubeTitle||'YouTube video',poster:host.dataset.youtubePoster||''}));
 return {videoId,mount,destroy,destroyWithin,choose};
})();
