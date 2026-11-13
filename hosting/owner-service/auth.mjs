const encoder=new TextEncoder(),name='__Host-sp-studio',flowName='__Host-sp-oauth';
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const unbase=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function key(secret){if(typeof secret!=='string'||secret.length<32)throw new Error('Owner sign-in is not configured');return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function seal(value,secret){const body=b64(encoder.encode(JSON.stringify(value)));return body+'.'+b64(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body)));}
export async function unseal(token,secret){try{if(typeof token!=='string'||token.length>4096)return null;const [body,signature,...rest]=token.split('.');if(rest.length||!signature||!await crypto.subtle.verify('HMAC',await key(secret),unbase(signature),encoder.encode(body)))return null;const data=JSON.parse(new TextDecoder().decode(unbase(body)));return Number.isSafeInteger(data.exp)&&data.exp>Date.now()?data:null;}catch{return null;}}
const cookie=(request,key)=>(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1)||'';
const setCookie=(key,value,age)=>key+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
export function configured(env){return Boolean(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.SESSION_SECRET?.length>=32&&/^\d+$/.test(env.OWNER_GITHUB_ID||''));}
export async function ownerFor(request,env){if(!configured(env))return null;const data=await unseal(cookie(request,name),env.SESSION_SECRET);return data?.kind==='session'&&String(data.id)===env.OWNER_GITHUB_ID&&data.login===env.OWNER_GITHUB_LOGIN.toLowerCase()?{userId:String(data.id),email:'spsequencevisuals@gmail.com',displayName:'SP',fullName:'SP'}:null;}
export function sameOrigin(request){if(request.headers.get('origin')!==new URL(request.url).origin||!['same-origin','none',''].includes(request.headers.get('sec-fetch-site')||''))return false;return true;}
export async function startSignIn(request,env){
 if(!configured(env))return new Response('The owner sign-in needs its one-time account setup.',{status:503});
 const state=b64(crypto.getRandomValues(new Uint8Array(32))),verifier=b64(crypto.getRandomValues(new Uint8Array(32))),callback=new URL('/auth/callback',request.url).href;
 const challenge=b64(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
 const flow=await seal({kind:'oauth',state,verifier,callback,exp:Date.now()+600000},env.SESSION_SECRET);
 const target=new URL('https://github.com/login/oauth/authorize');target.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:callback,login:env.OWNER_GITHUB_LOGIN,scope:'',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
 return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':setCookie(flowName,flow,600),'Cache-Control':'no-store'}});
}
export async function finishSignIn(request,env,fetcher=fetch){
 const url=new URL(request.url),flow=await unseal(cookie(request,flowName),env.SESSION_SECRET);
 if(!configured(env)||flow?.kind!=='oauth'||flow.state!==url.searchParams.get('state')||flow.callback!==new URL('/auth/callback',request.url).href||!url.searchParams.get('code'))return new Response('Sign-in expired. Start again from the owner studio.',{status:403});
 try{
 const result=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:flow.callback,code_verifier:flow.verifier}),signal:AbortSignal.timeout(15000)});
 const token=await result.json();if(!result.ok||!token.access_token)throw new Error();
 const response=await fetcher('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token.access_token,'User-Agent':'SP-Sequence-Owner-Studio'},signal:AbortSignal.timeout(15000)}),profile=await response.json();
 if(!response.ok||String(profile.id)!==env.OWNER_GITHUB_ID||profile.login?.toLowerCase()!==env.OWNER_GITHUB_LOGIN.toLowerCase())throw new Error();
 const session=await seal({kind:'session',id:String(profile.id),login:profile.login.toLowerCase(),nonce:crypto.randomUUID(),exp:Date.now()+28800000},env.SESSION_SECRET);
 const headers=new Headers({Location:'/studio','Cache-Control':'no-store'});headers.append('Set-Cookie',setCookie(name,session,28800));headers.append('Set-Cookie',setCookie(flowName,'',0));return new Response(null,{status:303,headers});
 }catch{return new Response('Sign in with your SP Sequence Visuals GitHub account to open this studio.',{status:403});}
}
export function signOut(){return new Response(null,{status:303,headers:{Location:'/studio','Set-Cookie':setCookie(name,'',0),'Cache-Control':'no-store'}});}

