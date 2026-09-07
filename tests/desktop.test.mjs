import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {Desktop,validateApp} from '../server/desktop.mjs';
import {ContextStore} from '../server/context-store.mjs';
const app={pid:123,bundleId:'test.contextflow.fixture',name:'Test app'};
test('desktop captures bind process and bundle, and refreshed text becomes new evidence',async()=>{
 const store=new ContextStore();let text='First accessibility content';const calls=[];
 const desktop=new Desktop({store,binary:process.execPath,run:async(file,args)=>{calls.push(args);return {stdout:JSON.stringify({title:'Test app',text,pid:123,bundleId:app.bundleId,warnings:[]})}}});
 const source=await desktop.capture(app);assert.equal(source.transport,'app');assert.equal(source.appPid,123);assert.equal(source.bundleId,app.bundleId);assert.deepEqual(calls[0],['capture','123',app.bundleId]);text='Latest changed content';const updated=await desktop.capture(app,source.id);assert.equal(updated.id,source.id);assert.equal(updated.revision,2);assert.equal(store.retrieve('latest',[source.id])[0].text,text);
 for(const value of [{pid:'123',bundleId:'test'}, {pid:123,bundleId:'../../bad'}, {pid:-1,bundleId:'test'}])assert.throws(()=>validateApp(value),/Select/);
});
test('live audio uses pinned provider, stores real transcript output, cleans chunks and stops',async()=>{
 const store=new ContextStore();const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('close',0);
 let invoked;const ai={settings:async()=>({transcription:{provider:'test',model:'speech'},providers:[{id:'test',hasKey:true}]}),catalog:async()=>({transcription:['speech']}),transcribe:async args=>{invoked=args;return {text:'The meeting deadline is Friday.'}}};
 const desktop=new Desktop({store,ai,binary:process.execPath,run:async()=>({stdout:JSON.stringify({available:true,apps:[app]})}),launch:()=>child});
 try{
  await desktop.start(app,false);assert.equal(desktop.view().active,true);await assert.rejects(desktop.start(app),/Stop/);
  const s=desktop.session;await writeFile(path.join(s.directory,'segment.wav'),'isolated-test-audio');desktop.event(s,{event:'started'});desktop.event(s,{event:'chunk',path:'segment.wav',track:'app'});await s.chain;
  assert.deepEqual(invoked.selection,{provider:'test',model:'speech'});assert.equal(s.pending,0);assert.equal(store.detail(s.sourceId).transport,'audio');assert.match(store.detail(s.sourceId).text,/deadline is Friday/);
  assert.throws(()=>desktop.event(s,{event:'chunk',path:'../../secrets.wav'}),/Invalid/);
  desktop.discard(s.sourceId);assert.equal(s.discard,true);assert.equal(s.stopping,true);child.emit('close',0);assert.equal(desktop.view().active,false);
 }finally{desktop.dispose();if(desktop.session)await rm(desktop.session.directory,{recursive:true,force:true})}
});

test('desktop endpoints reject rebinding hosts before accessing application data',async()=>{
 const {createApi}=await import('../server/api.mjs');let called=false;const api=createApi({desktop:{status:async()=>{called=true;return {apps:[]}}}});let status;let body;await api({url:'/api/desktop',method:'GET',headers:{host:'attacker.example:5173','sec-fetch-site':'same-origin'}},{writeHead:n=>status=n,end:text=>body=text});assert.equal(status,403);assert.equal(called,false);assert.match(body,/localhost/);
});
