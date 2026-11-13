import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

class Element extends EventTarget{
 constructor(){super();this.children=[];this.attrs={};this.classList={add(){}};this.isConnected=true;this.top=150;this.hidden=false;this.dataset={};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k]??null;}
 getBoundingClientRect(){return {top:this.top,bottom:this.top+300,left:50,right:450,width:400,height:300};}
 contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
 matches(){return false;}
 remove(){this.isConnected=false;}
}
function setup(){
 const window=new EventTarget(),document=new EventTarget(),frames=[],players=[],polls=new Set();let timers=0;
 Object.assign(window,{innerWidth:1000,innerHeight:800,requestAnimationFrame:fn=>frames.push(fn),matchMedia:()=>({matches:false,addEventListener(){}})});
 Object.assign(document,{hidden:false,head:new Element(),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>new Element()});
 class Player{
  constructor(target,options){Object.assign(this,{target,options,frame:new Element(),time:0,plays:0,pauses:0,destroyed:false});players.push(this);}
  ready(){this.options.events.onReady({target:this});}
  getIframe(){return this.frame;}
  mute(){this.muted=true;}
  unMute(){this.muted=false;}
  playVideo(){this.plays++;this.options.events.onStateChange({data:1,target:this});}
  pauseVideo(){this.pauses++;this.options.events.onStateChange({data:2,target:this});}
  getCurrentTime(){return this.time;}
  seekTo(time){this.time=time;}
  destroy(){this.destroyed=true;}
 }
 window.YT={Player};
 const context=vm.createContext({window,document,Promise,URL,Event,location:{origin:'https://portfolio.example'},setTimeout:()=>++timers,clearTimeout(){},setInterval:fn=>{polls.add(fn);return fn;},clearInterval:fn=>polls.delete(fn)});
 for(const file of ['video-playback.js','youtube-player.js'])vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);
 const flush=()=>{let n=0;while(frames.length){assert.ok(++n<30);frames.shift()();}};
 return {window,document,players,polls,flush,host:()=>new Element()};
}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('YouTube and an uploaded video share one playback owner, including manual playback and hidden tabs',async()=>{
 const {window,document,players,flush,host}=setup(),youtube=host();window.SPYouTube.mount(youtube,{url:'https://youtu.be/M7lc1UVf-VE'});flush();await settle();players[0].ready();await settle();assert.equal(youtube.paused,false);
 const uploaded=host();uploaded.paused=true;uploaded.play=()=>{uploaded.paused=false;uploaded.dispatchEvent(new Event('play'));return Promise.resolve();};uploaded.pause=()=>{uploaded.paused=true;uploaded.dispatchEvent(new Event('pause'));};window.SPVideoPlayback.register(uploaded);window.SPVideoPlayback.play(uploaded);assert.equal(youtube.paused,true);assert.equal(uploaded.paused,false);
 players[0].playVideo();assert.equal(uploaded.paused,true);assert.equal(youtube.paused,false);
 document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(youtube.paused,true);assert.equal(uploaded.paused,true);
});
test('closing a YouTube viewer while its player loads cannot restart the removed film',async()=>{
 const {window,players,flush,host}=setup(),youtube=host();window.SPYouTube.mount(youtube,{url:'https://youtu.be/M7lc1UVf-VE'});flush();await settle();window.SPYouTube.destroy(youtube);youtube.isConnected=false;players[0].ready();await settle();assert.equal(players[0].plays,0);assert.equal(players[0].destroyed,true);assert.equal(youtube.paused,true);
});
test('a blocked autoplay still allows the viewer to press Play, and preview limits leave full films unrestricted',async()=>{
 const {window,players,polls,flush,host}=setup(),preview=host();window.SPYouTube.mount(preview,{url:'https://youtu.be/M7lc1UVf-VE',previewSeconds:60});flush();await settle();players[0].ready();await settle();players[0].options.events.onAutoplayBlocked();assert.equal(preview.paused,true);players[0].playVideo();assert.equal(preview.paused,false);
 players[0].time=61;for(const poll of polls)poll();assert.equal(players[0].time,0);
 const full=host();window.SPYouTube.mount(full,{url:'https://youtu.be/M7lc1UVf-VE'});window.SPVideoPlayback.play(full);await settle();players[1].ready();await settle();players[1].time=350;for(const poll of polls)poll();assert.equal(players[1].time,350);assert.equal(preview.paused,true);
});
