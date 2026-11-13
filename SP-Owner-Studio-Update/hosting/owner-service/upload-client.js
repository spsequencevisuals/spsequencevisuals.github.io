 function uploadFile(file,statusId,onXhr){
  if(!['video/mp4','video/webm','image/jpeg','image/png','image/webp'].includes(file.type))return Promise.reject(new Error('Use MP4, WebM, JPEG, PNG or WebP.'));
  if(!file.size||file.size>500000000)return Promise.reject(new Error('Choose a file up to 500 MB.'));
  uploadCount++;updateBusy();let cancelled=false,current=null;
  if(onXhr)onXhr({abort(){cancelled=true;current?.abort();}});
  async function run(){
   const session=await api('/api/studio/uploads',{method:'POST',body:{filename:file.name,mime:file.type,bytes:file.size}});
   try{
    for(let part=1;part<=session.parts;part++){
     if(cancelled)throw new Error('Upload cancelled.');
     const offset=(part-1)*session.partBytes,body=file.slice(offset,Math.min(file.size,offset+session.partBytes));
     let lastError;
     for(let attempt=0;attempt<3;attempt++){
      try{await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();current=xhr;xhr.open('PUT','/api/studio/uploads/'+session.id+'/parts/'+part);xhr.timeout=180000;xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.upload.onprogress=event=>message(statusId,'Uploading '+file.name+' · '+Math.min(100,Math.round((offset+event.loaded)/file.size*100))+'%');xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{reject(new Error('Upload part not confirmed.'));return;}if(xhr.status>=200&&xhr.status<300)resolve();else{const error=new Error(data.error||'Upload failed.');error.status=xhr.status;reject(error);}};xhr.onerror=()=>reject(new Error('Upload connection failed.'));xhr.ontimeout=()=>reject(new Error('Upload timed out.'));xhr.onabort=()=>reject(new Error('Upload cancelled.'));xhr.send(body);});lastError=null;break;}catch(error){lastError=error;if(cancelled||error.status&&error.status<500)break;}
     }
     if(lastError)throw lastError;
    }
    if(cancelled)throw new Error('Upload cancelled.');
    const result=await api('/api/studio/uploads/'+session.id+'/complete',{method:'POST',body:{},timeout:60000});
    assets=[result.asset,...assets.filter(x=>x.id!==result.asset.id)];renderMedia();message(statusId,'Uploaded '+file.name+'.');return result.asset;
   }catch(error){if(!cancelled){try{const result=await api('/api/studio/uploads/'+session.id+'/complete',{method:'POST',body:{},timeout:60000});if(result.asset){assets=[result.asset,...assets.filter(x=>x.id!==result.asset.id)];renderMedia();return result.asset;}}catch{}}await api('/api/studio/uploads/'+session.id,{method:'DELETE'}).catch(()=>{});throw error;}
  }
  return run().finally(()=>{uploadCount--;updateBusy();});
 }

