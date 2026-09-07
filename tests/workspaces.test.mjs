import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {createServer} from 'node:http';
import {createApi} from '../server/api.mjs';
import {ProviderConfig} from '../server/provider-config.mjs';
import {ProviderAI} from '../server/providers.mjs';
import {Workspaces} from '../server/workspaces.mjs';
test('workspaces persist names and reject invalid paths and duplicate names',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'cf-spaces-'));
 try{const r=new Workspaces(dir),w=r.create('Interview');assert.equal(new Workspaces(dir).get(w.id).name,'Interview');assert.throws(()=>r.create('INTERVIEW'));assert.throws(()=>r.folder('../escape'));}finally{rmSync(dir,{recursive:true,force:true})}
});
test('workspace sources are isolated across requests and restored after restart',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'cf-spaces-')),config=new ProviderConfig({directory:dir,env:{}});
 let server;
 async function start(){server=createServer(createApi({ai:new ProviderAI({config})}));await new Promise(r=>server.listen(0,'127.0.0.1',r));}
 async function request(route,workspace='default',method='GET',body){
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/'+route+'?workspace='+workspace,{method,headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};
 }
 try{
  await start();const w=(await request('workspaces','default','POST',{name:'Other'})).data;
  assert.ok(w.id);assert.equal((await request('sources',w.id)).data.sources.length,0);
  const {data}=await request('capture','default','POST',{url:'https://example.com',text:'Only in default',title:'Sample'});
  assert.ok(data.source.id);assert.equal((await request('sources')).data.sources.length,1);
  assert.equal((await request('sources',w.id)).data.sources.length,0);
  assert.equal((await request('workspaces',w.id)).data.current,w.id);
  await new Promise(r=>server.close(r));await start();
  assert.equal((await request('workspaces',w.id)).data.current,w.id);
  assert.equal((await request('sources')).data.sources.length,1);
  assert.equal((await request('sources',w.id)).data.sources.length,0);
 }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true})}
});
