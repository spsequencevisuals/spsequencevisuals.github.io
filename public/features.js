'use strict';
let portfolioVideos=[],videoLoadObserver;
function pauseGridVideos(){window.SPVideoPlayback.pauseAll();}
function stopGridVideos(){window.SPYouTube?.destroyWithin(grid);videoLoadObserver?.disconnect();portfolioVideos.forEach(video=>{window.SPVideoPlayback.unregister(video);video.removeAttribute('src');video.load();});portfolioVideos=[];}
function loadPortfolioVideo(video){if(!video.getAttribute('src')){video.src=video.dataset.src;video.load();}}
function resumeGridVideos(){window.SPVideoPlayback.refresh();}
function speakerIcon(on){return `<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 4 6 8H3v8h3l5 4V4Z"/>${on?'<path d="M15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>':'<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;}
function syncPortfolioControls(video){
 const card=video.closest('.project-card'),playing=!video.paused&&!video.ended;
 const play=card.querySelector('.video-play-toggle');play.innerHTML=playing?'❚❚ <span>Pause</span>':'▶ <span>Play</span>';play.setAttribute('aria-label',(playing?'Pause ':'Play ')+video.getAttribute('aria-label'));
 const sound=card.querySelector('.video-sound-toggle');sound.innerHTML=speakerIcon(!video.muted)+`<span>${video.muted?'Sound off':'Sound on'}</span>`;sound.setAttribute('aria-pressed',String(!video.muted));sound.setAttribute('aria-label',(video.muted?'Turn on sound for ':'Mute ')+video.getAttribute('aria-label'));
}
function prepareGridVideos(){
 document.querySelectorAll('#project-grid .project-card').forEach(old=>{
  const project=projects.find(p=>p.id===old.dataset.project);if(!project)return;
  const preview=window.SPVideoPlayback.previewFor(project);
  const card=document.createElement('article');card.className=old.className;card.innerHTML=old.innerHTML;old.replaceWith(card);
  const picture=card.querySelector('.project-picture'),title=card.querySelector('h3');
  title.innerHTML=`<button type="button" data-project="${project.id}">${safe(project.title)}<span aria-hidden="true">↗</span></button>`;
  const share=document.createElement('div');share.className='card-share-actions';share.innerHTML=`<a href="${window.SPStudioConfig?.apiBase||''}/work/${project.id}">${preview?'Watch full film · '+safe(project.duration):'Project details'} ↗</a><button type="button" data-copy-project="${project.id}">Copy review link ⧉</button>${project.behindScenes?`<a href="${window.SPStudioConfig?.apiBase||''}/work/${project.id}#timeline">Timeline reveal ↗</a>`:''}`;card.querySelector('.project-meta').append(share);
  if(project.type==='image'){
   if(project.categories.includes('photo'))card.classList.add('photo-card');
   const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='image-project';imageButton.dataset.project=project.id;imageButton.setAttribute('aria-label','View '+project.title);imageButton.append(picture.querySelector('img'));imageButton.append(picture.querySelector('.play-circle'));picture.prepend(imageButton);return;
  }
  if(window.SPYouTube?.videoId(project.media)){
   card.classList.add('video-card','youtube-card');picture.replaceChildren();
   const host=document.createElement('div');picture.append(host);
   window.SPYouTube.mount(host,{url:project.media,title:project.title,hoverTarget:card,muted:true,loop:true,previewSeconds:preview?.seconds||0});
   const order=document.createElement('button');order.type='button';order.className='project-order';order.dataset.contact='';order.dataset.service='Video editing';order.textContent='Request a similar edit ↗';card.querySelector('.project-meta').append(order);return;
  }
  card.classList.add('video-card');picture.querySelector('img').remove();picture.querySelector('.play-circle').remove();picture.querySelector('.duration').remove();
  const video=document.createElement('video');video.className='portfolio-video';video.dataset.src=preview?.media||project.media;video.dataset.previewSeconds=String(preview?.seconds||0);video.poster=project.poster;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=true;video.preload='none';video.tabIndex=-1;video.setAttribute('aria-label',project.title+(preview?' · 60-second preview':''));picture.prepend(video);
  if(preview){const badge=document.createElement('span');badge.className='preview-badge';badge.textContent='60s PREVIEW';picture.append(badge);}
  const open=document.createElement('button');open.type='button';open.className='video-project-open';open.dataset.project=project.id;open.setAttribute('aria-label','Open project: '+project.title);picture.append(open);
  const controls=document.createElement('div');controls.className='inline-video-controls';controls.innerHTML=`<button type="button" class="video-play-toggle" aria-label="Play ${safe(project.title)}">▶ <span>Play</span></button><button type="button" class="video-sound-toggle" aria-label="Turn on sound for ${safe(project.title)}" aria-pressed="false">${speakerIcon(false)}<span>Sound off</span></button><span class="inline-duration">${preview?'Preview 01:00':safe(project.duration)}</span><button type="button" data-project="${project.id}" class="video-expand" aria-label="Open ${safe(project.title)} with full video controls">⛶</button>`;picture.append(controls);
  const error=document.createElement('p');error.className='video-error';error.hidden=true;error.innerHTML=`Video unavailable. <a href="${project.media}" target="_blank" rel="noopener">Open video ↗</a>`;picture.append(error);
  const order=document.createElement('button');order.type='button';order.className='project-order';order.dataset.contact='';order.dataset.service='Video editing';order.textContent='Request a similar edit ↗';card.querySelector('.project-meta').append(order);
  ['play','pause','ended','volumechange'].forEach(event=>video.addEventListener(event,()=>syncPortfolioControls(video)));
  video.addEventListener('error',()=>{error.hidden=false;});
  controls.querySelector('.video-play-toggle').addEventListener('click',()=>{if(video.paused)window.SPVideoPlayback.play(video);else window.SPVideoPlayback.pause(video);});
  controls.querySelector('.video-sound-toggle').addEventListener('click',()=>{const enable=video.muted;portfolioVideos.forEach(other=>{if(other!==video)other.muted=true;});video.muted=!enable;window.SPVideoPlayback.play(video);});
  portfolioVideos.push(video);
  window.SPVideoPlayback.register(video,{load:()=>loadPortfolioVideo(video),hoverTarget:card,previewSeconds:preview?.seconds||0});
 });
 if('IntersectionObserver' in window){
  videoLoadObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){loadPortfolioVideo(entry.target);videoLoadObserver.unobserve(entry.target);}}),{rootMargin:'220px 0px'});
  portfolioVideos.forEach(video=>videoLoadObserver.observe(video));
 }
 window.SPVideoPlayback.refresh();
}
const hoverHint=matchMedia('(hover: hover) and (pointer: fine)');
function updateVideoHint(){const hint=document.querySelector('.view-label');if(hint)hint.textContent=hoverHint.matches?'HOVER TO PLAY · CLICK TO OPEN':'VIDEOS PLAY MUTED · TAP TO OPEN';}
hoverHint.addEventListener('change',updateVideoHint);updateVideoHint();

function initializeBooking(){
 const form=document.getElementById('brief-form'),submit=document.getElementById('submit-request'),status=document.getElementById('form-status'),success=document.getElementById('request-success');
 const requestId=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
 let key=requestId(),sending=false,reference='';
 const receiptKey='sp-request-receipt';
 form.elements.preferredDate.min=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const scrollToForm=()=>document.getElementById('booking-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 function updateKind(){const session=form.elements.intent.value==='session';
  document.getElementById('date-label').innerHTML=session?'Preferred session date <span aria-hidden="true">*</span>':'Target delivery date <small>optional</small>';form.elements.preferredDate.required=session;
  document.getElementById('time-field').hidden=!session;form.elements.preferredTime.disabled=!session;
  document.getElementById('details-label').innerHTML=(session?'What would you like to discuss?':'Tell me about your project')+' <span aria-hidden="true">*</span>';
  document.getElementById('booking-note').textContent=session?'Choose a preferred date and time in West Africa Time (WAT). SP will reply to confirm availability; this does not reserve a slot yet.':'This starts a service request. SP will confirm the scope, price and delivery date with you before work begins.';
  if(!sending)document.getElementById('submit-label').textContent=session?'Request a session':'Send service request';
 }
 function reset(){form.reset();key=requestId();form.hidden=false;success.hidden=true;status.hidden=true;try{sessionStorage.removeItem(receiptKey);}catch{}document.getElementById('retry-new-request').hidden=true;updateKind();}
 function emailDraft(data={},reference=''){
  const labels=[['name','Name'],['email','Reply email'],['phone','Phone / WhatsApp'],['service','Service'],['budget','Budget'],['preferredDate','Preferred date'],['preferredTime','Preferred time (WAT)'],['details','Project brief'],['referenceUrl','Inspiration link']];
  const body=['Hello SP,',data.intent==='session'?'I would like to request a session.':'I would like to request a creative service.',reference?'Saved request reference: '+reference:'',...labels.filter(([key])=>data[key]).map(([key,label])=>label+': '+data[key]),reference?'Private studio: '+location.origin+'/studio-inbox':''].filter(Boolean).join('\n\n');
  return 'mailto:spsequencevisuals@gmail.com?subject='+encodeURIComponent('SPSequence Visuals — '+(reference||data.service||'Project request'))+'&body='+encodeURIComponent(body);
 }
 const directEmail=document.getElementById('send-email-instead');
 const updateEmailDraft=()=>{directEmail.href=emailDraft(Object.fromEntries(new FormData(form)));};
 form.addEventListener('input',updateEmailDraft);form.addEventListener('change',updateEmailDraft);
 directEmail.addEventListener('click',event=>{if(sending||!form.reportValidity()){event.preventDefault();return;}updateEmailDraft();});
 updateEmailDraft();
 function emailReceiptText(state){
  if(state==='accepted')return 'The email service accepted your brief for delivery to spsequencevisuals@gmail.com.';
  if(state==='sending')return 'Your request is saved. Sending your brief to SP by email…';
  return 'Your request is saved. Email delivery is not confirmed; you can also send the brief using your email app below.';
 }
 function showReceipt(receipt,email='',scroll=false,request=null){
  reference=receipt.reference;document.getElementById('request-reference').textContent=reference;
  document.getElementById('receipt-email-status').textContent=emailReceiptText(receipt.emailState);
  document.getElementById('success-message').textContent=receipt.intent==='session'?'Your session request is saved in SP’s private inbox. SP will contact you to agree on availability.':'Your service request is saved in SP’s private inbox. SP will contact you to agree on the scope, quote and delivery date.';
  document.getElementById('success-email').textContent=email;document.getElementById('success-email-line').hidden=!email;
  document.getElementById('receipt-followup').href=emailDraft(request||{},reference);
  document.getElementById('receipt-followup').textContent=request?'Also send this brief by email ↗':'Email SP about this request ↗';
  form.hidden=true;success.hidden=false;if(scroll){success.focus({preventScroll:true});scrollToForm();}
 }
 document.getElementById('retry-new-request').addEventListener('click',()=>{key=requestId();status.hidden=true;document.getElementById('retry-new-request').hidden=true;notify('Review your details and send your new request.');});
 form.querySelectorAll('[name="intent"]').forEach(input=>input.addEventListener('change',updateKind));
 document.querySelectorAll('.service').forEach(detail=>{const actions=document.createElement('div');actions.className='service-booking-actions';const service=detail.querySelector('h3').textContent;actions.innerHTML=`<button type="button" data-contact data-service="${safe(service)}">Order this service ↗</button><button type="button" data-contact data-service="${safe(service)}" data-intent="session">Book a session ↗</button>`;detail.querySelector('.service-detail').append(actions);});
 document.addEventListener('click',e=>{const button=e.target.closest('[data-contact]');if(!button)return;if(form.hidden)reset();if(button.dataset.service)form.elements.service.value=button.dataset.service;if(button.dataset.intent)form.querySelector(`[name="intent"][value="${button.dataset.intent}"]`).checked=true;else form.querySelector('[name="intent"][value="order"]').checked=true;updateKind();scrollToForm();form.elements.name.focus({preventScroll:true});});
 document.getElementById('new-request').addEventListener('click',()=>{reset();form.elements.name.focus();});
 document.getElementById('copy-reference').addEventListener('click',()=>copyText(reference,'Request reference copied.'));
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending||!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));data.idempotencyKey=key;
  sending=true;submit.disabled=true;submit.setAttribute('aria-busy','true');document.getElementById('submit-label').textContent='Sending…';status.hidden=true;document.getElementById('retry-new-request').hidden=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});let result;try{result=await response.json();}catch{throw new Error('The website did not confirm this submission. Your details are still here. Please try again or email spsequencevisuals@gmail.com.');}
   if(!response.ok||!result.received||!result.reference){const error=new Error(result.error||'Your request could not be saved. Please try again.');error.status=response.status;throw error;}
   const receipt={reference:result.reference,intent:data.intent,receivedAt:Date.now(),emailState:result.email?.submission?'sending':'unknown'};
   const saveReceipt=()=>{try{sessionStorage.setItem(receiptKey,JSON.stringify(receipt));}catch{}};
   saveReceipt();showReceipt(receipt,data.email,true,data);clearTimeout(timeout);
   const delivery=result.email?.submission?await window.SPRequestEmail.send(result.email.submission):{state:'unknown'};
   receipt.emailState=delivery.state;saveReceipt();document.getElementById('receipt-email-status').textContent=emailReceiptText(delivery.state);
  }catch(error){status.textContent=error.name==='AbortError'?'The connection took too long. Your details are still here. Try again; the same request won’t be saved twice.':error instanceof TypeError?'No connection. Your request has not been confirmed. Reconnect and try again, or email spsequencevisuals@gmail.com.':error.message;status.hidden=false;document.getElementById('retry-new-request').hidden=error.status!==409;status.scrollIntoView({behavior:'instant',block:'nearest'});}
  finally{clearTimeout(timeout);sending=false;submit.disabled=false;submit.removeAttribute('aria-busy');updateKind();}
 });
 updateKind();
 try{const receipt=JSON.parse(sessionStorage.getItem(receiptKey));if(receipt&&/^SP-[A-F0-9]{12}$/.test(receipt.reference)&&['order','session'].includes(receipt.intent)&&Date.now()-receipt.receivedAt>=0&&Date.now()-receipt.receivedAt<86400000)showReceipt(receipt);}catch{}
}

document.addEventListener('click',event=>{const button=event.target.closest('[data-copy-project]');if(button)copyText((window.SPStudioConfig?.apiBase||location.origin)+'/view/'+button.dataset.copyProject,'Project review link copied.');});
