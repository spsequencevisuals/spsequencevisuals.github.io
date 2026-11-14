import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoId,youtubeWatchUrl} from '../lib/youtube.mjs';
import {validateProject} from '../lib/studio-data.mjs';
import {projectPage} from '../lib/project-page.ts';

const id='M7lc1UVf-VE';
test('YouTube links normalize individual videos without accepting lookalike hosts, playlists or executable URLs',()=>{
 for(const url of ['https://youtu.be/'+id+'?si=share','https://www.youtube.com/watch?v='+id+'&t=120','https://m.youtube.com/shorts/'+id,'https://www.youtube.com/live/'+id,'https://www.youtube-nocookie.com/embed/'+id])assert.equal(youtubeVideoId(url),id);
 for(const url of ['https://youtube.com.attacker.example/watch?v='+id,'https://www.youtube.com/playlist?list=PL123','javascript:alert(1)','http://youtu.be/'+id,'https://user:pass@youtu.be/'+id,'https://youtu.be/'+id+'/another','https://youtu.be/short','https://youtu.be:8443/'+id])assert.equal(youtubeVideoId(url),null,url);
 assert.equal(youtubeWatchUrl(id),'https://www.youtube.com/watch?v='+id);
});
test('a YouTube project clears uploaded main-media references and retains an optional uploaded cover',()=>{
 const data=validateProject({id:'linked-film',title:'Linked film',categories:['video'],status:'draft',description:'An unlisted film.',role:'Editor',videoSource:'youtube',youtubeUrl:'https://youtu.be/'+id,mediaId:'old-upload',posterId:'cover-upload'});
 assert.equal(data.mediaId,'');assert.equal(data.posterId,'cover-upload');assert.equal(data.youtubeUrl,youtubeWatchUrl(id));
 assert.throws(()=>validateProject({...data,youtubeUrl:'https://example.com/video.mp4'}),/YouTube/);
});
test('project and review pages use the YouTube player with a visible external fallback rather than a broken video source',()=>{
 const data={id:'linked-film',title:'A linked film',type:'video',categories:['video'],tags:['Editing'],status:'published',label:'FILM',description:'A film.',role:'Editor',format:'Landscape',duration:'18:20',media:youtubeWatchUrl(id),poster:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'};
 for(const review of [false,true]){const html=projectPage(data,'https://studio.example.com',review);assert.match(html,/data-youtube-url="https:\/\/www.youtube.com\/watch\?v=M7lc1UVf-VE"/);assert.match(html,/data-youtube-poster="https:\/\/i.ytimg.com\/vi\/M7lc1UVf-VE\/hqdefault.jpg"/);assert.match(html,/youtube-player.js/);assert.doesNotMatch(html,/<source src="https:\/\/www.youtube/);assert.match(html,/Watch A linked film on YouTube/);assert.match(html,/data-youtube-choice/);if(review)assert.match(html,/noindex,nofollow/);}
});
