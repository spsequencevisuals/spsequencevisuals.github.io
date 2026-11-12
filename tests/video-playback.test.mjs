import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultProjects} from '../lib/portfolio-defaults.mjs';

const script=readFileSync(new URL('../public/video-playback.js',import.meta.url),'utf8');
class Events{
 constructor(){this.listeners=new Map();}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
 emit(name,event={}){for(const fn of this.listeners.get(name)||[])fn(event);}
}
function setup(BroadcastChannel,hoverMatches=false){
 const window=new Events(),document=new Events(),frames=[],log=[];
 window.innerWidth=1000;window.innerHeight=800;window.requestAnimationFrame=fn=>frames.push(fn);
 window.IntersectionObserver=class{observe(){}unobserve(){}};
 const hoverQuery=new Events();hoverQuery.matches=hoverMatches;window.matchMedia=()=>hoverQuery;
 if(BroadcastChannel)window.BroadcastChannel=BroadcastChannel;
 document.hidden=false;document.modal=null;document.querySelector=()=>document.modal;
 vm.runInNewContext(script,{window,document,Promise});
 const api=window.SPVideoPlayback;
 function video(name,top=150,height=300){
  const v=new Events();Object.assign(v,{name,paused:true,isConnected:true,top,height,deferred:false,currentTime:0});
  v.getBoundingClientRect=()=>({top:v.top,bottom:v.top+v.height,left:50,right:450,width:400,height:v.height});
  v.play=()=>{
   log.push('play:'+name);
   if(v.deferred)return new Promise(resolve=>{v.finish=()=>{v.paused=false;v.emit('play');resolve();};});
   v.paused=false;v.emit('play');return Promise.resolve();
  };
  v.pause=()=>{if(v.paused)return;log.push('pause:'+name);v.paused=true;v.emit('pause');};
  return v;
 }
 function flush(){let count=0;while(frames.length){assert.ok(++count<20,'animation work stays bounded');frames.shift()();}}
 return {window,document,api,video,flush,log,hoverQuery};
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();};

test('two visible desktop previews have exactly one playback owner',()=>{
 const {api,video,flush}=setup();const a=video('a'),b=video('b');api.register(a);api.register(b);flush();
 assert.equal(a.paused,false);assert.equal(b.paused,true);
 api.play(b);api.refresh();assert.equal(a.paused,true);assert.equal(b.paused,false);
});
test('scrolling switches the centred video and pauses the previous one before starting the next',()=>{
 const {api,video,flush,document,log}=setup();const a=video('a'),b=video('b',950);api.register(a);api.register(b);flush();
 a.top=-250;b.top=180;document.emit('scroll');flush();
 assert.equal(a.paused,true);assert.equal(b.paused,false);
 assert.ok(log.indexOf('pause:a')<log.indexOf('play:b'));
 b.top=-400;document.emit('scroll');flush();assert.equal(b.paused,true);
});
test('a late buffered play cannot restart a video after swiping away',async()=>{
 const {api,video,flush,document}=setup();const a=video('a'),b=video('b',950);a.deferred=true;api.register(a);api.register(b);flush();
 a.top=-400;b.top=180;document.emit('scroll');flush();a.finish();await settle();flush();
 assert.equal(a.paused,true);assert.equal(b.paused,false);
});
test('returning during a pending play eventually resumes the current visible video',async()=>{
 const {api,video,flush,document}=setup();const a=video('a');a.deferred=true;api.register(a);flush();
 a.top=-400;document.emit('scroll');flush();a.top=180;a.deferred=false;document.emit('scroll');flush();
 a.finish();await settle();flush();await settle();
 assert.equal(a.paused,false);
});
test('a late play cannot steal playback from another visible desktop card',async()=>{
 const {api,video,flush}=setup();const a=video('a'),b=video('b');a.deferred=true;api.register(a);api.register(b);flush();
 api.play(b);a.finish();await settle();flush();assert.equal(a.paused,true);assert.equal(b.paused,false);
});
test('an intentional pause stays paused through viewport updates',()=>{
 const {api,video,flush,document}=setup();const a=video('a');api.register(a);flush();api.pause(a);document.emit('scroll');flush();assert.equal(a.paused,true);
 api.play(a);assert.equal(a.paused,false);a.pause();api.refresh();assert.equal(a.paused,true);
});
test('hidden tabs and navigation stop playback; a visible restored page resumes only its current video',async()=>{
 const {api,video,flush,document,window}=setup();const a=video('a');api.register(a);flush();await settle();
 document.hidden=true;document.emit('visibilitychange');assert.equal(a.paused,true);api.refresh();assert.equal(a.paused,true);
 document.hidden=false;document.emit('visibilitychange');flush();await settle();assert.equal(a.paused,false);
 window.emit('pagehide');assert.equal(a.paused,true);api.refresh();assert.equal(a.paused,true);
 window.emit('pageshow');flush();await settle();assert.equal(a.paused,false);
 window.emit('blur');assert.equal(a.paused,true);window.emit('focus');flush();await settle();assert.equal(a.paused,false);
});
test('an open project excludes gallery previews and scrolling past its player pauses it',async()=>{
 const {api,video,flush,document}=setup();const preview=video('preview');api.register(preview);flush();await settle();
 const project=video('project',160);const modal={open:true,contains:v=>v===project,getBoundingClientRect:()=>({left:20,right:980,top:40,bottom:760})};document.modal=modal;
 api.register(project,{root:modal});api.play(project);flush();await settle();assert.equal(preview.paused,true);assert.equal(project.paused,false);
 project.top=-400;document.emit('scroll');flush();assert.equal(project.paused,true);assert.equal(preview.paused,true);
});
test('a replaced project cannot resume from an old play promise',async()=>{
 const {api,video,flush}=setup();const old=video('old');old.deferred=true;api.register(old);flush();api.unregister(old);old.isConnected=false;
 const next=video('next');api.register(next);flush();old.finish();await settle();flush();assert.equal(old.paused,true);assert.equal(next.paused,false);
});
test('another open page takes playback ownership without auto-resume ping-pong',async()=>{
 const peers=[];class Channel{constructor(){peers.push(this);}postMessage(data){for(const peer of peers)if(peer!==this)peer.onmessage?.({data});}}
 const first=setup(Channel),second=setup(Channel),a=first.video('a'),b=second.video('b');
 first.api.register(a);first.flush();await settle();second.api.register(b);second.flush();assert.equal(b.paused,true);
 second.api.play(b);await settle();first.api.refresh();assert.equal(a.paused,true);assert.equal(b.paused,false);
 first.window.emit('focus');first.flush();await settle();second.api.refresh();assert.equal(a.paused,false);assert.equal(b.paused,true);
});
function card(){const element=new Events();element.contains=node=>node===element;return element;}
test('desktop gallery videos wait for hover and hand over without overlap',async()=>{
 const {api,video,flush}=setup(undefined,true),a=video('a'),b=video('b'),first=card(),second=card();
 api.register(a,{hoverTarget:first});api.register(b,{hoverTarget:second});flush();assert.equal(a.paused,true);assert.equal(b.paused,true);
 first.emit('pointerenter',{pointerType:'mouse'});await settle();assert.equal(a.paused,false);assert.equal(b.paused,true);
 first.emit('pointerleave');second.emit('pointerenter',{pointerType:'mouse'});flush();await settle();assert.equal(a.paused,true);assert.equal(b.paused,false);
 second.emit('pointerleave');flush();assert.equal(a.paused,true);assert.equal(b.paused,true);
});
test('touch devices still autoplay the visible card without hover',()=>{
 const {api,video,flush,document}=setup(),a=video('a'),target=card();api.register(a,{hoverTarget:target});flush();assert.equal(a.paused,false);
 target.emit('pointerenter',{pointerType:'touch'});target.emit('pointerleave');flush();assert.equal(a.paused,false);
 a.top=-400;document.emit('scroll');flush();assert.equal(a.paused,true);
});
test('keyboard focus can play a desktop preview and pointer capability changes are respected',async()=>{
 const {api,video,flush,hoverQuery}=setup(undefined,true),a=video('a'),target=card();api.register(a,{hoverTarget:target});flush();
 target.emit('focusin',{target:{matches:selector=>selector===':focus-visible'}});await settle();assert.equal(a.paused,false);
 target.emit('focusout',{relatedTarget:null});flush();assert.equal(a.paused,true);
 hoverQuery.matches=false;hoverQuery.emit('change');flush();await settle();assert.equal(a.paused,false);
});
test('60-second previews apply strictly above 15 minutes and use the full source when a saved preview is stale',()=>{
 const {api}=setup();const base={type:'video',media:'/full.mp4',duration:'15:00'};
 assert.equal(api.previewFor(base),null);assert.equal(api.previewFor({...base,duration:'08:17'}),null);
 assert.equal(api.previewFor({...base,duration:'00:15:00'}),null);
 assert.equal(api.previewFor({...base,duration:'15:01'}).seconds,60);
 assert.equal(api.previewFor({...base,duration:'00:15:01'}).seconds,60);
 const preview={media:'/preview.mp4',sourceMedia:'/full.mp4',seconds:60};
 assert.equal(api.previewFor({...base,duration:'18:22',preview}).media,'/preview.mp4');
 assert.equal(api.previewFor({...base,media:'/replacement.mp4',duration:'18:22',preview}).media,'/replacement.mp4');
 assert.deepEqual(defaultProjects.filter(p=>api.previewFor(p)).map(p=>p.id),['computer-basics']);
});
test('the gallery preview loops at 60 seconds while project playback stays unlimited',()=>{
 const {api,video,flush}=setup(),preview=video('preview'),full=video('full');api.register(preview,{previewSeconds:60});api.register(full);flush();
 preview.currentTime=60.1;preview.emit('timeupdate');assert.equal(preview.currentTime,0);assert.equal(preview.paused,false);
 full.currentTime=300;full.emit('timeupdate');assert.equal(full.currentTime,300);
 api.unregister(preview);preview.currentTime=65;preview.emit('timeupdate');assert.equal(preview.currentTime,65);
});
