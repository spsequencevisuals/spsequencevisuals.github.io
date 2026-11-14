import test from 'node:test';
import assert from 'node:assert/strict';
import {frameTime,thumbnailSize,suggestedFrames} from '../../../public/studio-thumbnails.mjs';

test('portrait and landscape video frames preserve aspect ratio within the thumbnail size limit',()=>{
 assert.deepEqual(thumbnailSize(3840,2160),{width:1280,height:720});
 assert.deepEqual(thumbnailSize(2160,3840),{width:720,height:1280});
 assert.deepEqual(thumbnailSize(640,360),{width:640,height:360});
 assert.throws(()=>thumbnailSize(0,1080),/not ready/);
 assert.throws(()=>thumbnailSize(Infinity,1080),/not ready/);
});
test('suggested frames stay within very short and long videos without seeking past their end',()=>{
 for(const duration of [.02,.5,60,7200]){
  const times=suggestedFrames(duration);assert.equal(times.length,6);
  assert.ok(times.every(time=>time>=0&&time<duration));
  assert.ok(times.every((time,index)=>!index||time>=times[index-1]));
 }
 assert.deepEqual(suggestedFrames(Infinity),[]);
 assert.deepEqual(suggestedFrames(0),[]);
 assert.equal(frameTime(3661.5),'01:01:01');
 assert.equal(frameTime(-1),'00:00');
 assert.equal(frameTime(Infinity),'00:00');
});
