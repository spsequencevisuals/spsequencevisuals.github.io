export function frameTime(seconds) {
 const raw=Number(seconds),value=Number.isFinite(raw)?Math.max(0,raw):0,whole=Math.floor(value);
 return (whole>=3600?String(Math.floor(whole/3600)).padStart(2,'0')+':':'')+String(Math.floor(whole/60)%60).padStart(2,'0')+':'+String(whole%60).padStart(2,'0');
}
export function thumbnailSize(width,height,limit=1280) {
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('The video frame is not ready yet.');
 const scale=Math.min(1,limit/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function suggestedFrames(duration,count=6) {
 if(!Number.isFinite(duration)||duration<=0)return [];
 const end=Math.max(0,duration-.05);
 return Array.from({length:count},(_,index)=>Math.min(end,duration*(.05+.9*index/Math.max(1,count-1))));
}
function mediaEvent(video,name,signal,timeout=12000) {
 return new Promise((resolve,reject)=>{
  const finish=error=>{clearTimeout(timer);video.removeEventListener(name,ready);video.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);error?reject(error):resolve();};
  const ready=()=>finish(),failed=()=>finish(new Error('This video cannot be previewed here. Choose an MP4 or WebM video from your device.')),aborted=()=>finish(new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>finish(new Error('The video is taking too long to load. Choose the original video from your device instead.')),timeout);
  video.addEventListener(name,ready,{once:true});video.addEventListener('error',failed,{once:true});signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();
 });
}
async function loadVideo(video,source,signal) {
 const ready=mediaEvent(video,'loadedmetadata',signal);video.src=source;video.load();await ready;
 if(!Number.isFinite(video.duration)||video.duration<=0)throw new Error('Choose a finished video with a readable duration.');
}
async function seek(video,time,signal) {
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 if(Math.abs(video.currentTime-time)<.015&&video.readyState>=2)return;
 const ready=mediaEvent(video,'seeked',signal);video.currentTime=time;await ready;
 if(video.readyState<2)await mediaEvent(video,'loadeddata',signal);
}
async function capture(video,limit=1280) {
 if(video.readyState<2||video.seeking)throw new Error('Wait for the selected frame to finish loading.');
 const canvas=document.createElement('canvas'),size=thumbnailSize(video.videoWidth,video.videoHeight,limit);canvas.width=size.width;canvas.height=size.height;
 const context=canvas.getContext('2d');if(!context)throw new Error('This browser could not prepare a thumbnail. Try uploading a screenshot instead.');
 context.drawImage(video,0,0,size.width,size.height);
 return new Promise((resolve,reject)=>{
  try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('This frame could not be saved. Choose another frame or upload a screenshot.')),'image/jpeg',.9);}
  catch{reject(new Error('This video does not allow frame capture. Choose the original video from your device, or upload a screenshot.'));}
 });
}

export function createThumbnailPicker({dialog,onUse,onClose}) {
 const $=id=>dialog.querySelector('#'+id),video=$('thumbnail-video'),slider=$('thumbnail-position'),use=$('use-thumbnail-frame'),samples=$('thumbnail-samples'),status=$('thumbnail-frame-status'),fileInput=$('thumbnail-source-file');
 let controller=null,sampler=null,sourceURL='',sourceLabel='',sampleURLs=[],busy=false,epoch=0;
 const announce=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
 function release(){controller?.abort();controller=null;video.pause();video.removeAttribute('src');video.load();if(sampler){sampler.pause();sampler.removeAttribute('src');sampler.load();sampler=null;}if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL='';sampleURLs.forEach(url=>URL.revokeObjectURL(url));sampleURLs=[];}
 function sync(){
  const duration=Number.isFinite(video.duration)?video.duration:0,ready=duration>0&&video.readyState>=2&&!video.seeking;
  slider.max=String(Math.max(0,duration-.01));slider.value=String(video.currentTime||0);slider.disabled=!duration||busy;
  $('thumbnail-time').textContent=frameTime(video.currentTime)+' / '+frameTime(duration);use.disabled=!ready||busy;
  $('thumbnail-previous').disabled=!duration||busy;$('thumbnail-next').disabled=!duration||busy;
  samples.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(Math.abs(Number(button.dataset.time)-video.currentTime)<.08)));
 }
 async function makeSamples(source,signal,token){
  const probe=document.createElement('video');sampler=probe;probe.crossOrigin='anonymous';probe.muted=true;probe.playsInline=true;probe.preload='metadata';
  try{
   await loadVideo(probe,source,signal);
   for(const time of suggestedFrames(probe.duration)){
    await seek(probe,time,signal);const blob=await capture(probe,360);if(token!==epoch||signal.aborted)return;
    const url=URL.createObjectURL(blob);sampleURLs.push(url);const button=document.createElement('button');button.type='button';button.className='thumbnail-sample';button.dataset.time=String(time);button.setAttribute('aria-label','Choose frame at '+frameTime(time));button.setAttribute('aria-pressed','false');
    const image=document.createElement('img');image.src=url;image.alt='';const label=document.createElement('span');label.textContent=frameTime(time);button.append(image,label);
    button.addEventListener('click',()=>{if(busy)return;video.pause();video.currentTime=time;sync();});samples.append(button);sync();
   }
  }catch(error){if(error.name!=='AbortError'&&token===epoch&&video.readyState>=2)announce('Use the video controls or position slider to choose any frame.');}
  finally{probe.pause();probe.removeAttribute('src');probe.load();if(sampler===probe)sampler=null;}
 }
 async function setSource({url,file,label,youtube=false}={}) {
  epoch++;const token=epoch;release();samples.replaceChildren();fileInput.value='';sourceLabel=label||file?.name||'Project video';busy=false;controller=new AbortController();const signal=controller.signal;
  $('thumbnail-source-name').textContent=sourceLabel;$('thumbnail-video-stage').hidden=!url&&!file;
  $('thumbnail-source-note').textContent=youtube?'Choose the original video from your device to pick an exact frame. Only the thumbnail image is uploaded; your YouTube link stays the same.':'Scrub the video or choose a suggested frame. You can also use the original video from your device; only the thumbnail image is uploaded.';
  sync();
  if(!url&&!file){announce('Choose a video from your device to see its frames.');return;}
  const source=file?(sourceURL=URL.createObjectURL(file)):url;announce('Loading the video…');
  try{await loadVideo(video,source,signal);await seek(video,Math.min(.6,video.duration*.05),signal);if(token!==epoch)return;sync();announce('Choose your frame, then select “Use this frame”.');void makeSamples(source,signal,token);}
  catch(error){if(token===epoch&&error.name!=='AbortError'){announce(error.message,true);sync();}}
 }
 for(const event of ['loadeddata','loadedmetadata','timeupdate','seeked','seeking','pause'])video.addEventListener(event,sync);
 slider.addEventListener('input',()=>{video.pause();video.currentTime=Number(slider.value);sync();});
 $('thumbnail-previous').addEventListener('click',()=>{video.pause();video.currentTime=Math.max(0,video.currentTime-1/30);sync();});
 $('thumbnail-next').addEventListener('click',()=>{video.pause();video.currentTime=Math.min(Math.max(0,video.duration-.01),video.currentTime+1/30);sync();});
 fileInput.addEventListener('change',()=>{const file=fileInput.files?.[0];if(file)void setSource({file,label:file.name});});
 use.addEventListener('click',async()=>{
  if(busy)return;const token=epoch;video.pause();busy=true;fileInput.disabled=true;sync();announce('Saving your selected frame…');
  try{const blob=await capture(video);await onUse(blob,{time:video.currentTime,label:sourceLabel});if(token===epoch)dialog.close();}
  catch(error){if(token===epoch)announce(error.message,true);}
  finally{if(token===epoch){busy=false;fileInput.disabled=false;sync();}}
 });
 $('close-thumbnail-picker').addEventListener('click',()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{epoch++;release();busy=false;fileInput.disabled=false;samples.replaceChildren();onClose?.();});
 return {open(source){if(!dialog.open)dialog.showModal();void setSource(source);},close(){if(dialog.open)dialog.close();}};
}
