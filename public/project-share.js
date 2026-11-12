document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const text=new URL(button.dataset.copy,location.href).href,status=document.getElementById('share-status');try{await navigator.clipboard.writeText(text);status.textContent='Link copied.';}catch{const input=document.createElement('textarea');input.value=text;document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();status.textContent=copied?'Link copied.':'Copy this link: '+text;}status.classList.add('visible');setTimeout(()=>status.classList.remove('visible'),4000);}));

document.querySelectorAll('video').forEach(video=>{video.muted=true;video.defaultMuted=true;window.SPVideoPlayback.register(video);});
window.SPVideoPlayback.refresh();
