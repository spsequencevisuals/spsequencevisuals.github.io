'use strict';
let inboxItems=[],nextCursor=null,inboxBusy=false,inboxSaving=0,olderPages=false;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses=['new','in-discussion','confirmed','completed','archived'];
const statusName=status=>status.replaceAll('-',' ');
const inboxStatus=document.getElementById('inbox-status');
function renderInbox(){
 const query=document.getElementById('search').value.trim().toLowerCase(),filter=document.getElementById('status-filter').value;
 const items=inboxItems.filter(item=>(filter==='all'||item.status===filter)&&(!query||[item.name,item.email,item.service,item.reference].join(' ').toLowerCase().includes(query)));
 const rows=document.getElementById('requests');
 if(!items.length){rows.innerHTML=`<div class="empty-state"><h2>${inboxItems.length?'No matching requests.':'A little quiet, for now.'}</h2><p>${inboxItems.length?'Try a different search or status.':'Client service orders and session requests will appear here.'}</p></div>`;return;}
 rows.innerHTML=items.map(item=>`<article class="request" data-id="${escapeHtml(item.id)}"><div class="request-head"><div><span class="request-ref">${escapeHtml(item.reference)}</span><h2>${escapeHtml(item.name)} · ${escapeHtml(item.service)}</h2><span class="request-kind">${item.intent==='session'?'Session request':'Service order request'}</span></div><div><span class="status-pill ${escapeHtml(item.status)}">${escapeHtml(statusName(item.status))}</span><div class="request-date">${escapeHtml(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at)))} WAT</div></div></div><div class="request-layout"><p class="request-body">${escapeHtml(item.details)}</p><dl class="request-details"><div><dt>Email</dt><dd><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></dd></div>${item.phone?`<div><dt>Phone / WhatsApp</dt><dd><a href="tel:${escapeHtml(item.phone.replace(/[^+\d]/g,''))}">${escapeHtml(item.phone)}</a></dd></div>`:''}<div><dt>Budget</dt><dd>${escapeHtml(item.budget||'Not specified')}</dd></div><div><dt>${item.intent==='session'?'Preferred session':'Target delivery'}</dt><dd>${escapeHtml(item.preferred_date||'To be agreed')}${item.preferred_time?' · '+escapeHtml(item.preferred_time)+' WAT':''}</dd></div>${item.reference_url?`<div><dt>Reference</dt><dd><a href="${escapeHtml(item.reference_url)}" target="_blank" rel="noopener noreferrer">Open reference ↗</a></dd></div>`:''}</dl></div><div class="request-actions"><a class="button secondary" href="mailto:${escapeHtml(item.email)}?subject=${encodeURIComponent('Your SPSequence Visuals request — '+item.reference)}">Reply by email ↗</a><label>Status<select class="request-status-select" aria-label="Status for ${escapeHtml(item.reference)}">${statuses.map(status=>`<option value="${status}"${item.status===status?' selected':''}>${escapeHtml(statusName(status))}</option>`).join('')}</select></label><button class="button save-status" type="button">Save status</button><span class="request-save-status" role="status"></span></div></article>`).join('');
}
async function loadInbox(append=false,quiet=false){
 if(quiet&&(document.hidden||olderPages||inboxSaving||document.activeElement?.closest('.request')||[...document.querySelectorAll('.request-status-select')].some(select=>select.value!==inboxItems.find(item=>item.id===select.closest('.request').dataset.id)?.status)))return;
 if(inboxBusy)return;inboxBusy=true;document.getElementById('refresh').disabled=true;document.getElementById('load-more').disabled=true;inboxStatus.textContent='Loading your requests…';
 try{const response=await fetch('/api/studio/requests'+(append&&nextCursor?'?before='+encodeURIComponent(nextCursor):''),{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load the inbox.');
  inboxItems=append?[...inboxItems,...data.items]:data.items;nextCursor=data.nextCursor;olderPages=append;renderEmailStatus(data.email);
  for(const status of statuses){const counter=document.getElementById('count-'+status);if(counter)counter.textContent=data.counts.find(row=>row.status===status)?.total||0;}
  const newCount=Number(data.counts.find(row=>row.status==='new')?.total||0);document.title=(newCount?'('+newCount+' new) ':'')+'Studio inbox · SPSequence Visuals';
  document.getElementById('load-more').hidden=!nextCursor;inboxStatus.textContent=`${inboxItems.length} request${inboxItems.length===1?'':'s'} loaded. Last refreshed ${new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'}).format(new Date())} WAT.`;renderInbox();
 }catch(error){inboxStatus.textContent=error.message+' Use Refresh inbox to try again.';}
 finally{inboxBusy=false;document.getElementById('refresh').disabled=false;document.getElementById('load-more').disabled=false;}
}
document.getElementById('refresh').addEventListener('click',()=>loadInbox());document.getElementById('load-more').addEventListener('click',()=>loadInbox(true));document.getElementById('search').addEventListener('input',renderInbox);document.getElementById('status-filter').addEventListener('change',renderInbox);
document.getElementById('requests').addEventListener('click',async event=>{const button=event.target.closest('.save-status');if(!button)return;const card=button.closest('.request'),id=card.dataset.id,status=card.querySelector('select').value,message=card.querySelector('.request-save-status');button.disabled=true;inboxSaving++;message.textContent='Saving…';
 try{const response=await fetch('/api/studio/requests/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save the status.');const oldStatus=inboxItems.find(item=>item.id===id).status;inboxItems.find(item=>item.id===id).status=status;[oldStatus,status].forEach((value,index)=>{if(oldStatus===status)return;const counter=document.getElementById('count-'+value);if(counter)counter.textContent=Math.max(0,Number(counter.textContent)+(index?1:-1));});card.querySelector('.status-pill').className='status-pill '+status;card.querySelector('.status-pill').textContent=statusName(status);message.textContent='Saved.';
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;inboxSaving--;}
});
setInterval(()=>loadInbox(false,true),30000);document.addEventListener('visibilitychange',()=>loadInbox(false,true));window.addEventListener('focus',()=>loadInbox(false,true));
let emailTestBusy=false,emailTestId=null;
function renderEmailStatus(email){
 if(!email||emailTestBusy)return;
 const messages={
  'ready':'Email form connected. Send a test and confirm it arrives in your brand inbox.',
  'previously-prepared':'This test was already prepared. Check Inbox and Spam before starting another test.',
  'unavailable':'A test could not be prepared. Your client requests remain saved below.',
  'configuration-required':'Email needs a form access key in the Site settings. Requests remain saved here.',
  'disabled':'Email sending is switched off in this environment. Orders are still saved here.',
  'sending':'An alert is being processed. Check your brand inbox shortly.',
  'accepted':'The email service accepted the latest message. Check Inbox and Spam to confirm it arrived.',
  'failed':'The email service did not accept the latest alert. Orders remain saved below. Try a test email.',
  'unknown':'Email delivery is unconfirmed. Check Inbox and Spam for the message. Orders remain saved below.'
 };
 document.getElementById('email-alerts').dataset.state=email.state;
 document.getElementById('email-status').textContent=messages[email.state]||messages.unknown;
 document.getElementById('test-email').disabled=['disabled','configuration-required'].includes(email.state);
}
document.getElementById('test-email').addEventListener('click',async()=>{
 if(emailTestBusy)return;emailTestBusy=true;
 const button=document.getElementById('test-email'),message=document.getElementById('email-status');
 button.disabled=true;message.textContent='Contacting the email service…';
 emailTestId=emailTestId||crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch('/api/studio/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotencyKey:emailTestId}),signal:controller.signal});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'The email test could not be started.');
  clearTimeout(timer);
  const delivery=result.email?.submission?await window.SPRequestEmail.send(result.email.submission):result.email;
  emailTestId=null;emailTestBusy=false;renderEmailStatus(delivery);
 }catch(error){message.textContent=(error.name==='AbortError'?'The connection timed out. Check Inbox and Spam before trying again.':error.message)+' Your client requests are still saved here.';}
 finally{clearTimeout(timer);emailTestBusy=false;button.disabled=false;}
});
loadInbox();
