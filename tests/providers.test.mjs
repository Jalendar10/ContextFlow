import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {ProviderConfig} from '../server/provider-config.mjs';
import {ProviderAI} from '../server/providers.mjs';
import {createApi} from '../server/api.mjs';
const fixture=()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contextflow-providers-'));return {directory,config:new ProviderConfig({directory,env:{}}),cleanup:()=>fs.rmSync(directory,{recursive:true,force:true})};};
const json=data=>({ok:true,json:async()=>data});
test('model roles persist independently; keys stay session-only unless remembered',()=>{
 const f=fixture();try{
  f.config.select('answer','anthropic','claude-test');f.config.select('transcription','groq','whisper-large-v3');f.config.setKey('anthropic','fixture-session-key');
  const restarted=new ProviderConfig({directory:f.directory,env:{}});assert.deepEqual(restarted.settings.answer,{provider:'anthropic',model:'claude-test'});assert.deepEqual(restarted.settings.transcription,{provider:'groq',model:'whisper-large-v3'});assert.equal(restarted.key('anthropic'),'');
  f.config.setKey('groq','fixture-persisted-key',true);assert.equal(new ProviderConfig({directory:f.directory,env:{}}).key('groq'),'fixture-persisted-key');
  assert.equal(fs.statSync(path.join(f.directory,'credentials.json')).mode&0o777,0o600);assert.equal(fs.statSync(f.directory).mode&0o777,0o700);
  const exposed=JSON.stringify(f.config.public());assert.ok(!exposed.includes('fixture-session-key'));assert.ok(!exposed.includes('fixture-persisted-key'));
  f.config.removeKey('groq');assert.equal(new ProviderConfig({directory:f.directory,env:{}}).key('groq'),'');
 }finally{f.cleanup()}
});
test('switching a remembered key to session-only removes its old disk copy',()=>{const f=fixture();try{f.config.setKey('openai','fixture-old-key',true);f.config.setKey('openai','fixture-new-key',false);assert.equal(f.config.key('openai'),'fixture-new-key');assert.equal(new ProviderConfig({directory:f.directory,env:{}}).key('openai'),'');assert.ok(!fs.readFileSync(path.join(f.directory,'credentials.json'),'utf8').includes('fixture-'));}finally{f.cleanup()}});
test('model discovery filters answer/audio capabilities and validates role selection',async()=>{
 const f=fixture();try{f.config.setKey('openai','fixture-openai-key');f.config.setKey('groq','fixture-groq-key');const ai=new ProviderAI({config:f.config,fetcher:async url=>url.includes('groq')?json({data:[{id:'whisper-large-v3-turbo'},{id:'llama-answer'}]}):json({data:[{id:'gpt-answer'},{id:'gpt-transcribe'},{id:'gpt-image-1'},{id:'whisper-1'}]})});
  const models=await ai.catalog('openai');assert.deepEqual(models.answer,['gpt-answer']);assert.deepEqual(models.transcription,['gpt-transcribe','whisper-1']);
  await ai.select('answer','openai','gpt-answer');await ai.select('transcription','groq','whisper-large-v3-turbo');assert.equal(f.config.settings.answer.model,'gpt-answer');assert.equal(f.config.settings.transcription.model,'whisper-large-v3-turbo');await assert.rejects(ai.select('transcription','openai','gpt-answer'),/not available/);
 }finally{f.cleanup()}
});
test('cloud answer routing sends keys only to the chosen provider and uses actual returned text',async()=>{
 for(const provider of ['openai','anthropic','gemini','groq']){const f=fixture();try{
  f.config.setKey(provider,'fixture-private-key');f.config.select('answer',provider,'test-model');let payload;
  const ai=new ProviderAI({config:f.config,fetcher:async(url,opts)=>{payload=JSON.parse(opts.body);assert.equal(opts.redirect,'error');assert.ok(JSON.stringify(opts.headers).includes('fixture-private-key'));assert.ok(!url.includes('fixture-private-key'));assert.match(JSON.stringify(payload),/Source fact/);assert.ok(!JSON.stringify(payload).includes('fixture-private-key'));
   if(provider==='openai'){assert.match(url,/api.openai.com\/v1\/responses$/);assert.equal(payload.store,false);return json({output:[{content:[{type:'output_text',text:'Real response [1].'}]}]});}
   if(provider==='anthropic'){assert.match(url,/api.anthropic.com\/v1\/messages$/);assert.equal(opts.headers['anthropic-version'],'2023-06-01');return json({content:[{type:'text',text:'Real response [1].'}]});}
   if(provider==='gemini'){assert.match(url,/generativelanguage.googleapis.com\/v1beta\/models\/test-model:generateContent$/);return json({candidates:[{content:{parts:[{text:'Real response [1].'}]}}]});}
   assert.match(url,/api.groq.com\/openai\/v1\/chat\/completions$/);return json({choices:[{message:{content:'Real response [1].'}}]});
  }});const answer=await ai.generate({question:'Question',evidence:[{citation:1,text:'Source fact'}]});assert.equal(answer.answer,'Real response [1].');assert.equal(answer.provider,provider);
 }finally{f.cleanup()}}
});
test('transcription routing is independent of answer routing and sends multipart audio',async()=>{
 for(const provider of ['openai','groq']){const f=fixture();try{
  f.config.setKey(provider,'fixture-private-key');f.config.select('transcription',provider,provider==='openai'?'gpt-transcribe':'whisper-large-v3');const before={...f.config.settings.answer};
  const ai=new ProviderAI({config:f.config,fetcher:async(url,opts)=>{if(url.endsWith('/models'))return json({data:[{id:f.config.settings.transcription.model}]});assert.match(url,/audio\/transcriptions$/);assert.ok(opts.body instanceof FormData);assert.equal(opts.body.get('model'),f.config.settings.transcription.model);assert.equal(opts.body.get('file').name,'audio.wav');assert.equal(opts.body.get('file').size,12);assert.ok(!opts.headers['Content-Type']);return json({text:'What is the pipeline SLA?'});}});
  const result=await ai.transcribe({buffer:Buffer.from('RIFFtestWAVE'),filename:'question.wav',type:'audio/wav'});assert.equal(result.text,'What is the pipeline SLA?');assert.equal(result.provider,provider);assert.deepEqual(f.config.settings.answer,before);
 }finally{f.cleanup()}}
});
test('keys missing, invalid files and provider auth errors fail without leaking credentials',async()=>{
 const f=fixture();try{
  const ai=new ProviderAI({config:f.config,fetcher:async()=>({ok:false,status:401,body:{cancel:async()=>{}},json:async()=>({error:{message:'Echo fixture-private-key'}})})});
  await assert.rejects(ai.transcribe({buffer:Buffer.from('a'),filename:'question.wav'}),/Add a OpenAI API key/);
  f.config.setKey('openai','fixture-private-key');await assert.rejects(ai.catalog('openai'),error=>error.message.includes('rejected')&&!error.message.includes('fixture-private-key'));
  await assert.rejects(ai.transcribe({buffer:Buffer.from('a'),filename:'script.exe'}),/format/);await assert.rejects(ai.transcribe({buffer:Buffer.alloc(25_000_001),filename:'big.wav'}),/25 MB/);
 }finally{f.cleanup()}
});
test('provider and binary transcription API is same-origin-only and never returns stored keys',async()=>{
 const f=fixture();const ai=new ProviderAI({config:f.config,fetcher:async url=>url.endsWith('/audio/transcriptions')?json({text:'Test transcript'}):json({data:[{id:'gpt-transcribe'}]})});const server=createServer(createApi({ai}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/api`;
 try{
  const local={'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'};
  assert.equal((await fetch(base+'/settings',{headers:{Origin:'https://hostile.example'}})).status,403);
  const save=await fetch(base+'/providers/openai',{method:'PUT',headers:local,body:JSON.stringify({key:'fixture-private-key'})});assert.equal(save.status,200);assert.ok(!(await save.text()).includes('fixture-private-key'));
  const result=await fetch(base+'/transcribe',{method:'POST',headers:{'Sec-Fetch-Site':'same-origin','Content-Type':'audio/wav','X-Filename':'test.wav'},body:Buffer.from('RIFFtestWAVE')});assert.equal(result.status,200);assert.equal((await result.json()).text,'Test transcript');
  const denied=await fetch(base+'/transcribe',{method:'POST',headers:{Origin:'https://hostile.example','Content-Type':'audio/wav'},body:'audio'});assert.equal(denied.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));f.cleanup()}
});
test('custom compatible providers persist their destination and expose live role catalogs',async()=>{
 const f=fixture();try{
  for(const baseUrl of ['http://example.com/v1','https://secret@example.com/v1','file:///tmp/api','https://example.com/v1?key=secret'])assert.throws(()=>f.config.addConnection({name:'Invalid',baseUrl}),/HTTPS/);
  const p=f.config.addConnection({name:'My endpoint',baseUrl:'https://models.example/v1/',transcriptionModels:['speech-v2']});
  f.config.setKey(p.id,'fixture-custom-key');assert.equal(new ProviderConfig({directory:f.directory,env:{}}).providers[p.id].baseUrl,'https://models.example/v1');
  const calls=[];const ai=new ProviderAI({config:f.config,fetcher:async(url,opts)=>{calls.push(url);assert.equal(opts.headers.Authorization,'Bearer fixture-custom-key');assert.equal(opts.redirect,'error');if(url.endsWith('/models'))return json({data:[{id:'answer-v3'},{id:'speech-v2'},{id:'whisper-new'},{id:'embedding-v2'}]});if(url.endsWith('/audio/transcriptions'))return json({text:'Custom speech'});return json({choices:[{message:{content:'Custom answer [1]'}}]});}});
  const catalog=await ai.catalog(p.id);assert.deepEqual(catalog.answer,['answer-v3']);assert.deepEqual(catalog.transcription,['speech-v2','whisper-new']);assert.equal(catalog.all.length,4);
  await ai.select('answer',p.id,'answer-v3');await ai.select('transcription',p.id,'speech-v2');assert.equal((await ai.generate({question:'q',evidence:[]})).answer,'Custom answer [1]');assert.equal((await ai.transcribe({buffer:Buffer.from('audio'),filename:'a.wav'})).text,'Custom speech');assert.ok(calls.every(url=>url.startsWith('https://models.example/v1/')));
 }finally{f.cleanup()}
});
test('an audio session can pin its model while the default transcription choice changes',async()=>{
 const f=fixture();try{f.config.setKey('openai','fixture-key-openai');const ai=new ProviderAI({config:f.config,fetcher:async(url,options)=>url.endsWith('/models')?json({data:[{id:'gpt-transcribe'},{id:'whisper-1'}]}):(assert.equal(options.body.get('model'),'whisper-1'),json({text:'Pinned audio'}))});const result=await ai.transcribe({buffer:Buffer.from('audio'),filename:'a.wav',selection:{provider:'openai',model:'whisper-1'}});assert.equal(result.model,'whisper-1');assert.equal(f.config.settings.transcription.model,'gpt-transcribe');}finally{f.cleanup()}
});
