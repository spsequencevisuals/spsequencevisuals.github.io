import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

class Element extends EventTarget{
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.className='';this.classList={add:word=>{this.className+=' '+word;},remove:word=>{this.className=this.className.split(' ').filter(value=>value!==word).join(' ');}};this.isConnected=true;this.top=150;this.hidden=false;this.dataset={};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this.attrs[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase())]=v;}
 getAttribute(k){return this.attrs[k]??null;}
 getBoundingClientRect(){return {top:this.top,bottom:this.top+300,left:50,right:450,width:400,height:300};}
 contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
 matches(selector){return selector.startsWith('.')?this.className.split(' ').includes(selector.slice(1)):selector.startsWith('[data-')?Object.hasOwn(this.attrs,selector.slice(1,-1)):false;}
 all(){return this.children.flatMap(child=>[child,...(child.all?.()||[])]);}
 querySelector(selector){return this.all().find(child=>child.matches(selector))||null;}
 set innerHTML(html){this.children=[];for(const match of html.matchAll(/<([a-z][a-z0-9-]*)([^>]*)>([^<]*)/g)){const child=new Element(match[1]);for(const attr of match[2].matchAll(/([a-z-]+)(?:="([^"]*)")?/g)){child.setAttribute(attr[1],attr[2]||'');if(attr[1]==='class')child.className=attr[2];if(attr[1]==='target')child.target=attr[2];}child.textContent=match[3];this.append(child);}}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatchEvent(new Event('close'));}
 focus(){this.focused=true;}
 click(){this.dispatchEvent(new Event('click',{cancelable:true}));}
 remove(){this.isConnected=false;}
}
function setup(hover=false){
 const window=new EventTarget(),document=new EventTarget(),frames=[],players=[],polls=new Set();let timers=0;
 Object.assign(window,{innerWidth:1000,innerHeight:800,requestAnimationFrame:fn=>frames.push(fn),matchMedia:()=>({matches:hover,addEventListener(){}})});
 const body=new Element('body'),openDialogs=()=>body.all().filter(item=>item.tagName==='DIALOG'&&item.open);
 Object.assign(document,{hidden:false,head:new Element('head'),body,querySelector:()=>openDialogs().at(-1)||null,querySelectorAll:selector=>selector==='dialog[open]'?openDialogs():[],createElement:tag=>new Element(tag)});
 class Player{
  constructor(target,options){Object.assign(this,{target,options,frame:new Element(),time:0,plays:0,pauses:0,destroyed:false});players.push(this);}
  ready(){this.options.events.onReady({target:this});}
  getIframe(){return this.frame;}
  mute(){this.muted=true;}
  unMute(){this.muted=false;}
  isMuted(){return this.muted;}
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
test('desktop YouTube cards autoplay on scroll without hover and yield to the next visible film',async()=>{
 const {window,document,players,flush,host}=setup(true),first=host(),second=host();second.top=1000;
 window.SPYouTube.mount(first,{url:'https://youtu.be/M7lc1UVf-VE',hoverTarget:host()});
 window.SPYouTube.mount(second,{url:'https://youtu.be/aqz-KE-bpKQ',hoverTarget:host()});flush();await settle();assert.equal(players.length,1);
 players[0].ready();await settle();assert.equal(first.paused,false);assert.equal(players[0].muted,true);
 first.top=-500;second.top=150;document.dispatchEvent(new Event('scroll'));flush();await settle();assert.equal(first.paused,true);assert.equal(players.length,2);
 players[1].ready();await settle();assert.equal(second.paused,false);assert.equal(players[0].pauses>0,true);
 second.top=1000;document.dispatchEvent(new Event('scroll'));flush();assert.equal(second.paused,true);
});
test('the YouTube action offers a choice and resumes the same in-site video without navigating',async()=>{
 const {window,document,players,flush,host}=setup(),video=host();window.SPYouTube.mount(video,{url:'https://youtu.be/M7lc1UVf-VE?si=share',title:'SP film'});flush();await settle();players[0].ready();await settle();players[0].time=42;players[0].unMute();
 const trigger=video.all().find(item=>item.tagName==='BUTTON'&&item.textContent==='View video on YouTube ↗');trigger.click();
 const dialog=document.querySelector('dialog[open]');assert.equal(dialog.open,true);assert.equal(video.paused,true);window.SPVideoPlayback.refresh();assert.equal(video.paused,true);
 assert.equal(dialog.querySelector('.youtube-choice-project').textContent,'SP film');const external=dialog.querySelector('[data-youtube-leave]');assert.equal(external.href,'https://www.youtube.com/watch?v=M7lc1UVf-VE');assert.equal(external.target,'_blank');
 dialog.querySelector('[data-youtube-stay]').click();await settle();assert.equal(dialog.open,false);assert.equal(video.paused,false);assert.equal(players[0].time,42);assert.equal(players[0].muted,false);assert.equal(trigger.focused,true);
 trigger.click();external.click();await settle();assert.equal(dialog.open,false);assert.equal(video.paused,true);
});
test('closing watch options respects a prior pause and destroying a project cannot revive its player',async()=>{
 const {window,document,players,flush,host}=setup(),video=host();window.SPYouTube.mount(video,{url:'https://youtu.be/M7lc1UVf-VE'});flush();await settle();players[0].ready();await settle();window.SPVideoPlayback.pause(video);
 const trigger=video.all().find(item=>item.tagName==='BUTTON');trigger.click();document.querySelector('dialog[open]').querySelector('.youtube-choice-close').click();await settle();assert.equal(video.paused,true);
 trigger.click();window.SPYouTube.destroy(video);await settle();assert.equal(document.querySelector('dialog[open]'),null);assert.equal(players[0].destroyed,true);assert.equal(video.paused,true);
 assert.equal(window.SPYouTube.choose(video,{url:'https://youtube.com.attacker.example/watch?v=M7lc1UVf-VE'}),null);
});
