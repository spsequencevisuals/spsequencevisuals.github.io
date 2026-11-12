// GitHub Pages has no private order database. Submit the brief directly to the
// owner's existing Web3Forms identifier, and report only provider acceptance.
function initializeBooking() {
 const form=document.getElementById('brief-form'),submit=document.getElementById('submit-request'),status=document.getElementById('form-status'),success=document.getElementById('request-success');
 let sending=false,reference='';
 const makeId=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
 const scrollToForm=()=>document.getElementById('booking-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 form.elements.preferredDate.min=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function updateKind(){
  const session=form.elements.intent.value==='session';
  document.getElementById('date-label').innerHTML=session?'Preferred session date <span aria-hidden="true">*</span>':'Target delivery date <small>optional</small>';
  form.elements.preferredDate.required=session;document.getElementById('time-field').hidden=!session;form.elements.preferredTime.disabled=!session;
  document.getElementById('details-label').innerHTML=(session?'What would you like to discuss?':'Tell me about your project')+' <span aria-hidden="true">*</span>';
  document.getElementById('booking-note').textContent=session?'SP will reply by email to confirm the session date and availability.':'SP will reply by email to agree on the scope, price and delivery date.';
  if(!sending)document.getElementById('submit-label').textContent=session?'Request a session':'Send service request';
 }
 function emailDraft(data={}){
  const fields=[['name','Name'],['email','Reply email'],['phone','Phone / WhatsApp'],['service','Service'],['budget','Budget'],['preferredDate','Preferred date'],['preferredTime','Preferred time (WAT)'],['details','Project brief'],['referenceUrl','Inspiration link']];
  const body=['Hello SP,',data.intent==='session'?'I would like to request a session.':'I would like to request a creative service.',reference?'Reference: '+reference:'',...fields.filter(([key])=>data[key]).map(([key,label])=>label+': '+data[key])].filter(Boolean).join('\n\n');
  return 'mailto:spsequencevisuals@gmail.com?subject='+encodeURIComponent('SPSequence Visuals — '+(reference||data.service||'Project request'))+'&body='+encodeURIComponent(body);
 }
 const emailLink=document.getElementById('send-email-instead');
 function updateEmail(){emailLink.href=emailDraft(Object.fromEntries(new FormData(form)));}
 function reset(){form.reset();reference='';form.hidden=false;success.hidden=true;status.hidden=true;updateKind();updateEmail();}
 form.addEventListener('input',updateEmail);form.addEventListener('change',updateEmail);
 emailLink.addEventListener('click',event=>{if(sending||!form.reportValidity())event.preventDefault();else updateEmail();});
 form.querySelectorAll('[name="intent"]').forEach(input=>input.addEventListener('change',updateKind));
 document.querySelectorAll('.service').forEach(detail=>{
  const actions=document.createElement('div');actions.className='service-booking-actions';const service=detail.querySelector('h3').textContent;
  actions.innerHTML=`<button type="button" data-contact data-service="${safe(service)}">Order this service ↗</button><button type="button" data-contact data-service="${safe(service)}" data-intent="session">Book a session ↗</button>`;detail.querySelector('.service-detail').append(actions);
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-contact]');if(!button)return;if(form.hidden)reset();
  if(button.dataset.service)form.elements.service.value=button.dataset.service;
  form.querySelector(`[name="intent"][value="${button.dataset.intent==='session'?'session':'order'}"]`).checked=true;
  updateKind();scrollToForm();form.elements.name.focus({preventScroll:true});
 });
 document.getElementById('new-request').addEventListener('click',()=>{reset();form.elements.name.focus();});
 document.getElementById('copy-reference').addEventListener('click',()=>copyText(reference,'Request reference copied.'));
 document.getElementById('retry-new-request').hidden=true;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending||!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));if(data.website)return;
  if(!window.SPStaticConfig?.formKey){status.hidden=false;status.textContent='Please use the email link to send your brief to SP.';return;}
  const id=makeId();reference='SP-'+id.replaceAll('-','').slice(0,12).toUpperCase();
  const fields={access_key:window.SPStaticConfig.formKey,from_name:'SPSequence Visuals portfolio',subject:'New SPSequence Visuals request — '+reference,name:data.name,email:data.email,replyto:data.email,request_reference:reference,request_type:data.intent==='session'?'Session request':'Creative service request',service:data.service,message:data.details,phone:data.phone||'',budget:data.budget||'',preferred_date:data.preferredDate||'',preferred_time_WAT:data.preferredTime||'',inspiration_link:data.referenceUrl||'',portfolio_url:location.origin+location.pathname};
  sending=true;submit.disabled=true;submit.setAttribute('aria-busy','true');document.getElementById('submit-label').textContent='Sending…';status.hidden=true;
  try{
   const result=await window.SPRequestEmail.send({id,fields});
   if(result.state!=='accepted')throw new Error(result.state==='failed'?'The email service could not accept this brief. Your details are still here. Please try again or use your email app.':'Email submission could not be confirmed. Your details are still here. You can use your email app to contact SP.');
   document.getElementById('request-reference').textContent=reference;
   document.getElementById('success-message').textContent=data.intent==='session'?'Your session enquiry was accepted by the email service. SP will reply to confirm availability.':'Your brief was accepted by the email service. SP will reply to agree on the scope, quote and delivery date.';
   document.getElementById('receipt-email-status').textContent='Submitted for delivery to spsequencevisuals@gmail.com. Email service acceptance does not confirm inbox delivery.';
   document.getElementById('success-email').textContent=data.email;document.getElementById('success-email-line').hidden=false;
   document.getElementById('receipt-followup').href=emailDraft(data);document.getElementById('receipt-followup').textContent='Email SP about this brief ↗';
   form.hidden=true;success.hidden=false;success.focus({preventScroll:true});scrollToForm();
  }catch(error){status.textContent=error.message;status.hidden=false;status.scrollIntoView({behavior:'instant',block:'nearest'});}
  finally{sending=false;submit.disabled=false;submit.removeAttribute('aria-busy');updateKind();}
 });
 updateKind();updateEmail();
}
