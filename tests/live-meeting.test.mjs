import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {readTextStream} from '../server/text-stream.mjs';
import {StreamingSpeech,ShortSpeech,wave} from '../server/live-transcription.mjs';
import {LiveMeeting,speakerTurns,parseQuestion} from '../server/live-meeting.mjs';
import {ContextStore} from '../server/context-store.mjs';
import {ProviderAI} from '../server/providers.mjs';
import {ProviderConfig} from '../server/provider-config.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';

test('SSE and NDJSON survive split JSON and split UTF-8 bytes',async()=>{
 const bytes=Buffer.from('data: {"delta":"café"}\r\n\r\ndata: [DONE]\n\n');const events=[];await readTextStream({body:Readable.from([...bytes].map(b=>Buffer.from([b])))},event=>events.push(event));assert.deepEqual(events,[{delta:'café'}]);const nd=[];await readTextStream({body:Readable.from([Buffer.from('{"a":1}\n{"a":'),Buffer.from('2}')])},e=>nd.push(e),{sse:false});assert.deepEqual(nd,[{a:1},{a:2}]);
});
test('streaming speech uses authorization header, handles interim/final/duplicate events and speaker changes',async()=>{
 class Socket extends EventEmitter{constructor(url,options){super();this.url=url;this.options=options;this.readyState=0;this.bufferedAmount=0;this.sent=[];queueMicrotask(()=>{this.readyState=1;this.emit('open')})}send(value){this.sent.push(value)}terminate(){this.readyState=3;this.emit('close')}}
 const received=[];const speech=new StreamingSpeech({key:'test-only-secret',model:'nova-3',track:'meeting',onText:e=>received.push(e),onError:assert.fail,Socket});await speech.ready;
 assert.equal(speech.socket.options.headers.Authorization,'Token test-only-secret');assert.ok(!speech.socket.url.includes('test-only-secret'));assert.match(speech.socket.url,/diarize_model=latest/);
 const result={type:'Results',start:0,duration:2,is_final:false,channel:{alternatives:[{transcript:'What is the deadline?',words:[{word:'What',speaker:0},{word:'deadline?',speaker:1}]}]}};speech.event(result);speech.event({...result,is_final:true,speech_final:true});speech.event({...result,is_final:true,speech_final:true});assert.equal(received.length,2);assert.equal(received[0].final,false);assert.equal(received[1].final,true);assert.deepEqual(speakerTurns(received[1],true).map(t=>t.speaker),['Speaker 1','Speaker 2']);assert.equal(speakerTurns({...received[1],track:'microphone'},true)[0].speaker,'You · microphone');speech.write(Buffer.alloc(100));assert.equal(speech.socket.sent.length,1);speech.abort();
});
test('short audio mode flushes at speech pause and does not upload silence',async()=>{
 const calls=[],texts=[];const controller=new AbortController();const ai={transcribe:async x=>{calls.push(x);return {text:'A real provider result'}}};const audio=new ShortSpeech({ai,selection:{provider:'groq',model:'whisper'},track:'meeting',onText:t=>texts.push(t),onError:assert.fail,signal:controller.signal});audio.write(Buffer.alloc(48000));assert.equal(calls.length,0);const voice=Buffer.alloc(48000);for(let i=0;i<voice.length;i+=2)voice.writeInt16LE(1000,i);audio.write(voice);audio.write(Buffer.alloc(30000));await audio.finish();assert.equal(calls.length,1);assert.equal(calls[0].buffer.toString('ascii',0,4),'RIFF');assert.equal(texts[0].final,true);assert.equal(wave(Buffer.alloc(240)).readUInt32LE(24),24000);
});
function harness(autoAnswer=true){const store=new ContextStore(),pipes=[],calls=[];const ai={config:{key:()=> 'fixture-key'},settings:async()=>({transcription:{provider:'deepgram',model:'nova-3'},answer:{provider:'ollama',model:'test-local'},providers:[{id:'deepgram',hasKey:true}]}),catalog:async()=>({transcription:['nova-3'],streaming:['nova-3']}),status:async()=>({ready:true}),generate:async args=>{calls.push(args);if(args.onDelta){args.onDelta('Suggested ');args.onDelta('answer.');return {answer:'Suggested answer.'}}return {answer:'{"question":null}'}}};const speechFactory=options=>{const stream={...options,ready:Promise.resolve(),write(){},async finish(){},abort(){}};pipes.push(stream);return stream};const meeting=new LiveMeeting({ai,store,desktop:{view:()=>({active:false})},speechFactory});return {store,pipes,calls,meeting,autoAnswer};}
test('meeting asks only on final speech, skips detection for explicit questions, streams answer and deduplicates',async()=>{
 const h=harness();await h.meeting.start({kind:'tab',name:'Test tab'});const s=h.meeting.session;try{
 h.pipes[0].onText({track:'meeting',text:'What is the',final:false});assert.equal(h.meeting.view().questions.length,0);assert.equal(h.meeting.view().interim.meeting,'What is the');
 h.pipes[0].onText({track:'meeting',text:'What is the deadline?',final:true,boundary:true});await s.detectionChain;await s.answerChain;assert.equal(h.calls.length,1);assert.equal(h.meeting.view().questions[0].answer,'Suggested answer.');assert.equal(h.meeting.view().questions[0].status,'complete');assert.ok(h.meeting.view().questions[0].firstTokenMs!==null);assert.equal(h.store.detail(s.sourceId).text.includes('What is the deadline?'),true);
 h.pipes[0].onText({track:'meeting',text:'What is the deadline?',final:true,boundary:true});await s.detectionChain;await s.answerChain;assert.equal(s.questions.length,1);
 await h.meeting.stop(s.id);assert.equal(h.meeting.view().active,false);assert.throws(()=>h.meeting.audio(s.id,'meeting',Buffer.alloc(100)),/ended/);
 }finally{h.meeting.discard()}
});
test('statements do not generate answers; context deletion clears transcripts and cancels session',async()=>{const h=harness();await h.meeting.start({kind:'microphone'});try{const s=h.meeting.session;h.pipes[0].onText({track:'microphone',text:'Thanks for joining today.',final:true,boundary:true});await s.detectionChain;assert.equal(s.questions.length,0);assert.equal(h.calls.length,1);h.meeting.discard(s.sourceId);assert.deepEqual(h.meeting.view().turns,[]);assert.equal(s.controller.signal.aborted,true);assert.equal(s.active,false);assert.equal(parseQuestion('{"question":null}'),null);assert.throws(()=>parseQuestion('not json'));}finally{h.meeting.discard()}});
test('no-auto-answer mode still transcribes and allows an explicit question',async()=>{const h=harness();await h.meeting.start({kind:'microphone',autoAnswer:false});try{const s=h.meeting.session;h.pipes[0].onText({track:'microphone',text:'What happened?',final:true,boundary:true});await s.detectionChain;assert.equal(s.questions.length,0);h.meeting.manual(s.id,'Explain this meeting.');await s.answerChain;assert.equal(s.questions.length,1);assert.equal(s.questions[0].status,'complete');assert.throws(()=>h.meeting.audio(s.id,'unknown',Buffer.alloc(100)),/PCM16/);}finally{h.meeting.discard()}});
test('cloud answer adapters stream text for all supported answer APIs',async()=>{
 for(const provider of ['openai','anthropic','gemini','groq']){const directory=mkdtempSync(path.join(os.tmpdir(),'cf-live-model-'));try{const config=new ProviderConfig({directory,env:{}});config.setKey(provider,'fixture-provider-key');const event=provider==='openai'?{type:'response.output_text.delta',delta:'Live answer'}:provider==='anthropic'?{type:'content_block_delta',delta:{type:'text_delta',text:'Live answer'}}:provider==='gemini'?{candidates:[{content:{parts:[{text:'Live answer'}]}}]}:{choices:[{delta:{content:'Live answer'}}]};const ai=new ProviderAI({config,fetcher:async(url,options)=>{const body=JSON.parse(options.body);if(provider==='gemini')assert.match(url,/streamGenerateContent/);else assert.equal(body.stream,true);return {ok:true,body:Readable.from([Buffer.from('data: '+JSON.stringify(event)+'\n\n')])}}});const deltas=[];const result=await ai.generate({selection:{provider,model:'test-model'},question:'q',evidence:[],onDelta:t=>deltas.push(t)});assert.equal(result.answer,'Live answer');assert.deepEqual(deltas,['Live answer']);}finally{rmSync(directory,{recursive:true,force:true})}}
});
test('concurrent starts are rejected and cancellation during preload never starts capture',async()=>{
 const h=harness();let release;h.meeting.ai.warmup=()=>new Promise(resolve=>release=resolve);const start=h.meeting.start({kind:'microphone'});await assert.rejects(h.meeting.start({kind:'microphone'}),/already starting/);while(!release)await new Promise(r=>setImmediate(r));const id=h.meeting.session.id;await h.meeting.stop(id);release();await assert.rejects(start,/canceled/);assert.equal(h.pipes.length,0);assert.equal(h.meeting.view().active,false);
});
test('Deepgram catalog reports only supported batch/streaming STT models and uses raw audio',async()=>{
 const directory=mkdtempSync(path.join(os.tmpdir(),'cf-deepgram-'));try{const config=new ProviderConfig({directory,env:{}});config.setKey('deepgram','fixture-key');const ai=new ProviderAI({config,fetcher:async(url,options)=>{assert.equal(options.headers.Authorization,'Token fixture-key');if(url.endsWith('/models'))return {ok:true,json:async()=>({stt:[{name:'nova-3',canonical_name:'nova-3',streaming:true,batch:true},{name:'flux-general',streaming:true,batch:false}],tts:[{name:'aura'}]})};assert.ok(Buffer.isBuffer(options.body));assert.match(url,/listen\?model=nova-3/);return {ok:true,json:async()=>({results:{channels:[{alternatives:[{transcript:'Hello from audio',words:[]}]}]}})};}});const models=await ai.catalog('deepgram');assert.deepEqual(models.answer,[]);assert.deepEqual(models.streaming,['nova-3']);config.select('transcription','deepgram','nova-3');assert.equal((await ai.transcribe({buffer:Buffer.from('audio'),filename:'a.wav',type:'audio/wav'})).text,'Hello from audio');}finally{rmSync(directory,{recursive:true,force:true})}
});
test('meeting answers include both reference sections, attached text and editable prompt',async()=>{const h=harness();await h.meeting.start({kind:'tab',context:{content:'Project goals',additionalContent:'Budget facts',files:[{name:'notes.txt',text:'Delivery Friday'}],prompt:'Answer in two sentences.'}});h.meeting.manual(h.meeting.view().id,'When is delivery?');await h.meeting.session.answerChain;const call=h.calls.find(c=>c.onDelta);const payload=JSON.parse(call.question);assert.equal(payload.referenceContent.content,'Project goals');assert.equal(payload.referenceContent.additionalContent,'Budget facts');assert.equal(payload.referenceContent.files[0].text,'Delivery Friday');assert.match(call.system,/Answer in two sentences/);await h.meeting.stop(h.meeting.view().id);});
test('manual transcript response handles statements and uses the selected turn',async()=>{const h=harness();await h.meeting.start({kind:'tab',autoAnswer:false});h.meeting.transcript(h.meeting.session,{track:'meeting',final:true,text:'The deployment is delayed.',boundary:true});const turn=h.meeting.session.turns[0];h.meeting.respondToTurn(h.meeting.session.id,turn.id);await h.meeting.session.answerChain;assert.equal(h.meeting.session.questions[0].text,'The deployment is delayed.');assert.equal(h.meeting.session.questions[0].turnId,turn.id);assert.equal(h.meeting.session.questions[0].status,'complete');assert.throws(()=>h.meeting.respondToTurn(h.meeting.session.id,'missing'),/not found/);await h.meeting.stop(h.meeting.session.id)});
test('clear questions bypass a blocked detector and two answers can start together',async()=>{
 const h=harness();await h.meeting.start({kind:'tab'});const s=h.meeting.session;
 const releases=[];
 h.meeting.ai.generate=async args=>{await new Promise(r=>releases.push(r));return {answer:'Answer',model:'test'}};
 let releaseDetector;s.detectionChain=new Promise(r=>releaseDetector=r);
 try{
  for(const text of ['What is SQL?','How do joins work?','Why use indexes?']){
   h.meeting.transcript(s,{track:'meeting',text,final:true,boundary:true});
  }
  await new Promise(r=>setImmediate(r));
  assert.equal(s.questions.length,3);
  assert.equal(releases.length,2);
  releases.shift()();await new Promise(r=>setImmediate(r));
  assert.equal(releases.length,2);
  releases.splice(0).forEach(r=>r());releaseDetector();
  await s.answerChain;
  assert.ok(s.questions.every(q=>q.status==='complete'));
 }finally{releaseDetector();releases.forEach(r=>r());h.meeting.discard()}
});
test('live speed preference only changes supported GPT-5.5 reasoning requests',async()=>{
 const directory=mkdtempSync(path.join(os.tmpdir(),'cf-fast-'));
 try{
  const config=new ProviderConfig({directory,env:{}});config.setKey('openai','fixture-key');
  const bodies=[];
  const ai=new ProviderAI({config,fetcher:async(url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Answer'}]}]})}}});
  for(const [model,latencySensitive] of [['gpt-5.5',true],['gpt-5.5',false],['gpt-5.5-pro',true]]){
   await ai.generateOnce({selection:{provider:'openai',model},question:'q',evidence:[],latencySensitive});
  }
  assert.deepEqual(bodies[0].reasoning,{effort:'none'});
  assert.equal(bodies[1].reasoning,undefined);assert.equal(bodies[2].reasoning,undefined);
 }finally{rmSync(directory,{recursive:true,force:true})}
});
