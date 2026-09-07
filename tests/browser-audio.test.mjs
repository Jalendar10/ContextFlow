import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserAudio} from '../live-audio-client.js';
test('tab capture resumes audio during user gesture and requests no focus transfer',async()=>{
 const calls=[];const originals=new Map(['navigator','AudioContext','CaptureController'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const track={getSettings:()=>({displaySurface:'browser'}),stop(){calls.push('stop')}};
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getDisplayMedia:async options=>{calls.push('picker');assert.equal(options.controller.behavior,'no-focus-change');assert.equal(options.audio,true);return {getVideoTracks:()=>[track],getAudioTracks:()=>[track],getTracks:()=>[track]}}}}});
  globalThis.AudioContext=class{resume(){calls.push('resume');return Promise.resolve()}close(){return Promise.resolve()}};
  globalThis.CaptureController=class{setFocusBehavior(value){this.behavior=value}};
  const audio=new BrowserAudio();await audio.choose('tab',false);assert.deepEqual(calls,['resume','picker']);audio.stop();await assert.rejects(audio.start('session',()=>{}),/ended before/);
 }finally{for(const [key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});
