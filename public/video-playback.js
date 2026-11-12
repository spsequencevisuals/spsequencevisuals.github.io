'use strict';
// One playback owner for gallery previews, project viewers and review pages.
window.SPVideoPlayback=(()=>{
 const records=new Map();
 let current=null,scheduled=false,suspended=false,focused=true,anotherPagePlaying=false,channel=null;
 const hoverMedia=window.matchMedia?.('(hover: hover) and (pointer: fine)');
 const hidden=()=>document.hidden||suspended||!focused||anotherPagePlaying;
 function view(record){
  const video=record.video;
  if(hidden()||!video.isConnected)return null;
  const dialog=document.querySelector('dialog[open]');
  if(dialog&&!dialog.contains(video))return null;
  if(record.root&&!record.root.open)return null;
  if(record.hoverTarget&&hoverMedia?.matches&&!record.keyboardFocused&&(!record.hovered||(record.hoverTarget.matches&&!record.hoverTarget.matches(':hover'))))return null;
  const rect=video.getBoundingClientRect();
  let left=0,top=0,right=window.innerWidth,bottom=window.innerHeight;
  if(record.root){const clip=record.root.getBoundingClientRect();left=Math.max(left,clip.left);top=Math.max(top,clip.top);right=Math.min(right,clip.right);bottom=Math.min(bottom,clip.bottom);}
  if(rect.width<=0||rect.height<=0||right<=left||bottom<=top)return null;
  const width=Math.max(0,Math.min(rect.right,right)-Math.max(rect.left,left));
  const height=Math.max(0,Math.min(rect.bottom,bottom)-Math.max(rect.top,top));
  const ratio=width*height/(rect.width*rect.height);
  if(ratio<.5)return null;
  return {ratio,distance:Math.abs((rect.top+rect.bottom)/2-(top+bottom)/2)};
 }
 function pause(record){
  record.attempt++;
  if(!record.video.paused){record.expectedPauses++;record.video.pause();}
 }
 function pauseOthers(keep){for(const record of records.values())if(record!==keep)pause(record);}
 function start(record){
  if(record.pending||!record.video.paused)return;
  record.load?.();
  const attempt=++record.attempt;
  record.pending=attempt;
  let result;
  try{result=record.video.play();}catch{record.pending=null;return;}
  Promise.resolve(result).then(()=>{
   // A buffered play() can finish after a fast swipe or project change.
   if(!records.has(record.video)||current!==record||record.userPaused||!view(record))pause(record);
  }).catch(()=>{}).finally(()=>{if(record.pending===attempt){record.pending=null;if(attempt!==record.attempt&&current===record&&!record.userPaused)schedule();}});
 }
 function refresh(){
  scheduled=false;
  let best=null,bestView=null;
  for(const record of records.values()){
   if(record.userPaused||record.ended||!record.autoplay)continue;
   const visible=view(record);if(!visible)continue;
   if(!best||visible.distance<bestView.distance-1){best=record;bestView=visible;}
  }
  // Keep a deliberate choice stable while two desktop cards share a row.
  const previous=current&&view(current);
  if(best&&previous&&!current.userPaused&&!current.ended&&current.autoplay&&previous.distance<=bestView.distance+24)best=current;
  current=best;
  pauseOthers(best);
  if(best)start(best);
 }
 function schedule(){if(!scheduled){scheduled=true;window.requestAnimationFrame(refresh);}}
 const observer='IntersectionObserver' in window?new window.IntersectionObserver(schedule,{threshold:[0,.25,.5,.75,1]}):null;
 function register(video,{root=null,autoplay=true,load=null,hoverTarget=null,previewSeconds=0}={}){
  if(records.has(video))return;
  const record={video,root,autoplay,load,hoverTarget,previewSeconds,hovered:!!hoverTarget?.matches?.(':hover'),keyboardFocused:false,userPaused:false,ended:false,attempt:0,pending:null,expectedPauses:0};
  record.onPlay=()=>{
   if(!view(record)||(record.pending&&current!==record)){pause(record);return;}
   record.userPaused=false;record.ended=false;current=record;pauseOthers(record);announcePlayback();
  };
  record.onPause=()=>{if(record.expectedPauses){record.expectedPauses--;return;}record.userPaused=true;};
  record.onEnded=()=>{record.ended=true;record.userPaused=true;if(current===record)current=null;schedule();};
  records.set(video,record);
  video.addEventListener('play',record.onPlay);
  video.addEventListener('pause',record.onPause);
  video.addEventListener('ended',record.onEnded);
  if(previewSeconds>0){record.onPreviewTime=()=>{if(video.currentTime>=previewSeconds)video.currentTime=0;};video.addEventListener('timeupdate',record.onPreviewTime);}
  if(hoverTarget){
   record.onEnter=event=>{if(event.pointerType==='touch')return;record.hovered=true;if(hoverMedia?.matches)play(video);};
   record.onLeave=()=>{record.hovered=false;if(hoverMedia?.matches&&!record.keyboardFocused){pause(record);if(current===record)current=null;schedule();}};
   record.onFocus=event=>{if(event.target?.matches?.(':focus-visible')){record.keyboardFocused=true;if(hoverMedia?.matches)play(video);}};
   record.onBlur=event=>{if(!hoverTarget.contains(event.relatedTarget)){record.keyboardFocused=false;if(hoverMedia?.matches&&!record.hovered){pause(record);if(current===record)current=null;schedule();}}};
   hoverTarget.addEventListener('pointerenter',record.onEnter);hoverTarget.addEventListener('pointerleave',record.onLeave);
   hoverTarget.addEventListener('focusin',record.onFocus);hoverTarget.addEventListener('focusout',record.onBlur);
  }
  observer?.observe(video);schedule();
 }
 function unregister(video){
  const record=records.get(video);if(!record)return;
  records.delete(video);observer?.unobserve(video);
  video.removeEventListener('play',record.onPlay);video.removeEventListener('pause',record.onPause);video.removeEventListener('ended',record.onEnded);
  if(record.onPreviewTime)video.removeEventListener('timeupdate',record.onPreviewTime);
  if(record.hoverTarget){record.hoverTarget.removeEventListener('pointerenter',record.onEnter);record.hoverTarget.removeEventListener('pointerleave',record.onLeave);record.hoverTarget.removeEventListener('focusin',record.onFocus);record.hoverTarget.removeEventListener('focusout',record.onBlur);}
  pause(record);if(current===record)current=null;
 }
 function play(video){
  const record=records.get(video);if(!record)return;anotherPagePlaying=false;if(!view(record))return;
  record.userPaused=false;record.ended=false;current=record;pauseOthers(record);if(video.paused)record.pending=null;start(record);
 }
 function pauseByUser(video){const record=records.get(video);if(!record)return;record.userPaused=true;pause(record);if(current===record)current=null;}
 function pauseAll(){current=null;for(const record of records.values())pause(record);}
 function otherPageStarted(){anotherPagePlaying=true;pauseAll();}
 function returnToPage(){anotherPagePlaying=false;schedule();}
 function previewFor(project){
  if(project.type!=='video'||!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(String(project.duration||'')))return null;
  const parts=project.duration.split(':').map(Number);
  if(parts.slice(1).some(part=>part>59)||parts.reduce((total,part)=>total*60+part,0)<=15*60)return null;
  const separate=typeof project.preview?.media==='string'&&project.preview.sourceMedia===project.media&&project.preview.seconds===60;
  return {seconds:60,media:separate?project.preview.media:project.media};
 }
 try{if('BroadcastChannel' in window){channel=new window.BroadcastChannel('spsequence-video-playback');channel.onmessage=event=>{if(event.data==='playing')otherPageStarted();};}}catch{}
 function announcePlayback(){try{if(channel)channel.postMessage('playing');else window.localStorage?.setItem('spsequence-video-owner',Date.now()+':'+Math.random());}catch{}}
 window.addEventListener('storage',event=>{if(event.key==='spsequence-video-owner'&&event.newValue)otherPageStarted();});
 // Capture scrolling inside the project dialog as well as the page.
 document.addEventListener('scroll',schedule,{capture:true,passive:true});
 window.addEventListener('resize',schedule,{passive:true});
 hoverMedia?.addEventListener?.('change',schedule);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAll();else returnToPage();});
 window.addEventListener('blur',()=>{focused=false;pauseAll();});
 window.addEventListener('focus',()=>{focused=true;returnToPage();});
 window.addEventListener('pagehide',()=>{suspended=true;pauseAll();});
 window.addEventListener('pageshow',()=>{suspended=false;focused=true;returnToPage();});
 // A deliberate interaction can take ownership back from another open page.
 for(const event of ['pointerdown','touchstart','wheel','keydown'])document.addEventListener(event,()=>{if(anotherPagePlaying)returnToPage();},{capture:true,passive:true});
 return {register,unregister,play,pause:pauseByUser,pauseAll,refresh,previewFor};
})();
