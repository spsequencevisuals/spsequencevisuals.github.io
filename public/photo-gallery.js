'use strict';
(()=>{
 let dialog,image,title,counter,caption,previous,next,photos=[],index=0,returnFocus=null,touch=null;
 function build(){
  if(dialog)return;dialog=document.createElement('dialog');dialog.className='photo-lightbox';dialog.setAttribute('aria-labelledby','photo-lightbox-title');
  const header=document.createElement('div');header.className='photo-lightbox-header';title=document.createElement('h2');title.id='photo-lightbox-title';
  const close=document.createElement('button');close.type='button';close.className='photo-close';close.textContent='Close ×';close.setAttribute('aria-label','Close photo viewer');close.addEventListener('click',()=>dialog.close());header.append(title,close);
  const figure=document.createElement('figure');image=document.createElement('img');image.className='photo-lightbox-image';caption=document.createElement('figcaption');figure.append(image,caption);
  const controls=document.createElement('div');controls.className='photo-lightbox-controls';previous=document.createElement('button');previous.type='button';previous.textContent='← Previous photo';next=document.createElement('button');next.type='button';next.textContent='Next photo →';counter=document.createElement('span');counter.setAttribute('aria-live','polite');previous.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));controls.append(previous,counter,next);dialog.append(header,figure,controls);document.body.append(dialog);
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(index-1);}if(event.key==='ArrowRight'){event.preventDefault();show(index+1);}});
  image.addEventListener('touchstart',event=>{const point=event.changedTouches[0];touch={x:point.clientX,y:point.clientY};},{passive:true});image.addEventListener('touchend',event=>{if(!touch)return;const point=event.changedTouches[0],x=point.clientX-touch.x,y=point.clientY-touch.y;touch=null;if(Math.abs(x)>45&&Math.abs(x)>Math.abs(y)*1.25)show(index+(x<0?1:-1));},{passive:true});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{document.body.classList.remove('photo-viewer-open');image.removeAttribute('src');returnFocus?.focus({preventScroll:true});});
 }
 function show(value){index=(value+photos.length)%photos.length;const photo=photos[index];image.src=photo.media;image.alt=photo.alt||title.textContent;caption.textContent=photo.caption||'';counter.textContent=String(index+1).padStart(2,'0')+' / '+String(photos.length).padStart(2,'0');previous.disabled=photos.length<2;next.disabled=photos.length<2;}
 function open(collection,value=0,name='Photography collection'){
  if(!Array.isArray(collection)||!collection.length)return;photos=collection.filter(photo=>{try{return ['https:','http:'].includes(new URL(photo.media,location.href).protocol);}catch{return false;}});if(!photos.length)return;
  build();returnFocus=document.activeElement;title.textContent=name;show(Math.max(0,Number(value)||0));document.body.classList.add('photo-viewer-open');if(!dialog.open)dialog.showModal();
 }
 window.SPPhotoGallery=Object.freeze({open});
 const data=document.getElementById('photo-gallery-data');if(data){try{const collection=JSON.parse(data.textContent);document.querySelectorAll('[data-photo-open]').forEach(button=>button.addEventListener('click',()=>open(collection,Number(button.dataset.photoOpen),document.querySelector('h1')?.textContent||'Photography collection')));}catch{}}
})();
