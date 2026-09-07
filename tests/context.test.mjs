import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ContextStore,answerQuestion} from '../server/context-store.mjs';
import {createApi} from '../server/api.mjs';
import {LocalAI} from '../server/ai.mjs';
import {isPublicIP} from '../server/public-page.mjs';
const sample=(url,text)=>({url,title:new URL(url).hostname,text});
test('retrieves late-page table data and isolates selected pages',()=>{
 const store=new ContextStore(),a=store.put(sample('https://a.example/','Introduction. '.repeat(5000)+'\nPipeline SLA | 5 minutes\nRetention | 90 days'));
 store.put(sample('https://b.example/private','Pipeline SLA is 60 minutes'));
 const evidence=store.retrieve('What is the pipeline SLA?',[a.id]);assert.ok(evidence.some(e=>e.text.includes('5 minutes')));assert.ok(evidence.every(e=>e.sourceId===a.id));assert.ok(!evidence.some(e=>e.text.includes('60 minutes')));
});
test('refresh increments revisions, unchanged refresh does not, and never re-enables revoked source',()=>{
 const store=new ContextStore(),a=store.put(sample('https://a.example/','Retention 90 days'));
 const b=store.put({...sample('https://a.example/','Retention 120 days'),sourceId:a.id});assert.equal(a.id,b.id);assert.equal(b.revision,2);
 const c=store.put({...sample('https://a.example/','Retention 120 days'),sourceId:a.id});assert.equal(c.revision,2);
 store.select([]);store.put({...sample('https://a.example/','Retention 180 days'),sourceId:a.id});assert.equal(store.sources.get(a.id).on,false);
 assert.throws(()=>store.retrieve('Retention',[a.id]),/unshared/);store.sources.delete(a.id);assert.throws(()=>store.put({...sample('https://a.example/','Retention 180 days'),sourceId:a.id}),/deleted/);
});
test('different same-URL tabs remain independent and refresh cannot follow navigation',()=>{
 const store=new ContextStore();const a=store.put({...sample('https://a.example/','First tab'),tabId:1,browserKey:'browser'});const b=store.put({...sample('https://a.example/','Second tab'),tabId:2,browserKey:'browser'});assert.notEqual(a.id,b.id);assert.throws(()=>store.put({...sample('https://other.example/','Navigated'),sourceId:a.id}),/URL changed/);
});
test('rejects empty, oversized and invalid captures and unknown selections',()=>{
 const store=new ContextStore();assert.throws(()=>store.put(sample('https://a.example','')),/no readable/);assert.throws(()=>store.put(sample('https://a.example','a'.repeat(8*1024*1024+1))),/limit/);assert.throws(()=>store.put({url:'file:///private',text:'abc'}),/HTTP/);assert.throws(()=>store.select(['fake']),/Unknown/);
});
test('small documents are passed in full for semantic and follow-up questions',()=>{
 const store=new ContextStore(),a=store.put(sample('https://a.example','Budget: 140 dollars.\nRecovery: restore snapshot.'));
 assert.match(store.retrieve('How much will this cost?',[a.id])[0].text,/140 dollars/);
});
test('no AI connection raises an error rather than returning a canned or extractive answer',async()=>{
 const store=new ContextStore(),s=store.put(sample('https://a.example','Retention is 90 days'));
 await assert.rejects(answerQuestion(store,{question:'Retention?',sourceIds:[s.id]}),/No AI provider/);
});
test('answers include selected source evidence and revocation cancels pending generation',async()=>{
 const store=new ContextStore(),s=store.put(sample('https://a.example','Retention is 90 days'));
 const result=await answerQuestion(store,{question:'What is retention?',sourceIds:[s.id]},{ai:{generate:async({evidence})=>{assert.equal(evidence[0].sourceId,s.id);return {answer:'90 days [1].',model:'unit-test-model'};}}});assert.equal(result.mode,'ai');assert.match(result.answer,/90 days/);
 await assert.rejects(answerQuestion(store,{question:'retention',sourceIds:[s.id]},{ai:{generate:async()=>{store.select([]);return{answer:'obsolete'};}}}),/Sources changed/);
});
test('Ollama adapter uses actual chat endpoint, selected content, and meaningful provider errors',async()=>{
 let called=false;const ai=new LocalAI({model:'configured-model',fetcher:async(url,opts)=>{called=true;assert.equal(url,'http://127.0.0.1:11434/api/chat');const payload=JSON.parse(opts.body);assert.equal(payload.model,'configured-model');assert.match(payload.messages[1].content,/90 days/);assert.equal(payload.stream,false);return {ok:true,json:async()=>({model:'configured-model',message:{content:'90 days [1].'}})};}});
 assert.equal((await ai.generate({question:'Retention?',evidence:[{citation:1,text:'90 days'}]})).answer,'90 days [1].');assert.ok(called);
 const offline=new LocalAI({fetcher:async()=>{throw Error('offline')}});assert.equal((await offline.status()).ready,false);
});
test('public URL capture rejects local, mapped, multicast and reserved IPs',()=>{
 for(const ip of ['127.0.0.1','10.1.1.1','169.254.169.254','172.16.1.2','192.168.1.2','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','224.0.0.1','2001:db8::1'])assert.equal(isPublicIP(ip),false,ip);
 for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(isPublicIP(ip),true,ip);
});
test('API rejects hostile origins and supports capture, question, model status and deletion',async()=>{
 const ai={status:async()=>({ready:true,model:'test-model'}),generate:async()=>({answer:'5 minutes [1].',model:'test-model'})};
 const server=createServer(createApi({ai}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/api`;
 try{
  assert.equal((await fetch(base+'/sources',{headers:{Origin:'https://hostile.example'}})).status,403);
  assert.equal((await fetch(base+'/sources',{headers:{Origin:'null'}})).status,403);
  const local={'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'};
  assert.equal((await(await fetch(base+'/ai',{headers:local})).json()).ready,true);
  const captured=await fetch(base+'/capture',{method:'POST',headers:local,body:JSON.stringify(sample('https://example.com','Pipeline SLA is 5 minutes'))});assert.equal(captured.status,200);const {source}=await captured.json();
  const response=await fetch(base+'/answer',{method:'POST',headers:local,body:JSON.stringify({question:'pipeline SLA',sourceIds:[source.id]})});assert.match((await response.json()).answer,/5 minutes/);
  await fetch(base+'/sources',{method:'DELETE',headers:local});assert.deepEqual((await(await fetch(base+'/sources',{headers:local})).json()).sources,[]);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
