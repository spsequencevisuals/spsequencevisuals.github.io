if(new URL(document.baseURI).hostname==='terminal.local'){
 const state=document.currentScript.dataset.outcome,original=window.fetch;let sends=0;
 try{sessionStorage.removeItem('sp-request-receipt');}catch{}
 window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,document.baseURI);
  if(url.origin==='https://api.web3forms.com'){sends++;document.documentElement.dataset.providerCalls=String(sends);document.documentElement.dataset.providerCredentials=init.credentials;if(state==='unknown')throw Error('Synthetic network failure');return Response.json({success:state==='accepted'});}
  const response=await original(input,init);
  if(url.pathname==='/api/requests'&&response.ok){const body=await response.json(),data=JSON.parse(init.body);return Response.json({...body,email:{state:'ready',submission:{id:data.idempotencyKey,fields:{access_key:'12345678-1234-4000-8000-123456789abc',name:data.name,email:data.email,message:data.details}}}},{status:response.status});}
  return response;
 };
 document.addEventListener('DOMContentLoaded',()=>{const form=document.getElementById('brief-form');for(const [name,value]of Object.entries({name:'Local synthetic email check',email:'local@example.invalid',details:'Synthetic local email flow validation only.'})){form.elements[name].value=value;}form.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('booking-panel').scrollIntoView({behavior:'instant'});});
}