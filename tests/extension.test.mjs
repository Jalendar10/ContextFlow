import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
function harness({granted=true}={}){
 let listener;const calls=[],records={},tabs=[{id:1,windowId:7,title:'Chosen page',url:'https://chosen.example/'},{id:2,windowId:7,title:'Other page',url:'https://other.example/'},{id:3,windowId:7,title:'Workspace',url:'http://localhost:5173/'}];
 const chrome={runtime:{id:'a'.repeat(32),getManifest:()=>({version:'2.0.0'}),getURL:path=>'chrome-extension://'+'a'.repeat(32)+'/'+path,onMessage:{addListener:fn=>listener=fn}},tabs:{query:async()=>tabs,get:async id=>{const t=tabs.find(t=>t.id===id);if(!t)throw Error('Tab closed');return t;}},scripting:{executeScript:async options=>{calls.push(options);return[{result:{title:'Chosen page',url:'https://chosen.example/',text:'Current text'}}];}},permissions:{contains:async()=>granted},storage:{session:{set:async data=>Object.assign(records,data),get:async key=>({[key]:records[key]}),remove:async key=>delete records[key]}},windows:{create:async options=>{calls.push({permissionWindow:options});return{id:9}}}};
 const code=fs.readFileSync(new URL('../extension/background.js',import.meta.url),'utf8').replace("import {extractPage} from './extract.js';",'const extractPage=()=>{};');
 vm.runInNewContext(code,{chrome,URL,crypto:webcrypto,Date,Map,Set,console});
 const sender={id:chrome.runtime.id,frameId:0,url:'http://localhost:5173/',tab:{id:3}};
 const send=(command,payload={},override=sender)=>new Promise(resolve=>listener({channel:'contextflow',command,payload},override,resolve));
 return {calls,tabs,send,sender,records};
}
test('extension lists real web tabs and captures only the explicit selected tab',async()=>{const h=harness();const listed=await h.send('tabs');assert.deepEqual(Array.from(listed.tabs,t=>t.id),[1,2]);const captured=await h.send('capture',{tabs:[h.tabs[0]]});assert.equal(captured.results.length,1);assert.equal(captured.results[0].page.text,'Current text');assert.equal(h.calls.length,1);assert.equal(h.calls[0].target.tabId,1);assert.equal(h.calls[0].world,'ISOLATED');});
test('extension rejects wrong page origins, nested frames and tab navigation',async()=>{const h=harness();assert.match((await h.send('tabs',{}, {...h.sender,url:'https://hostile.example/'})).error,/only from/);assert.match((await h.send('tabs',{}, {...h.sender,frameId:1})).error,/only from/);assert.match((await h.send('capture',{tabs:[{id:1,url:'https://old.example/'}]})).error,/navigated/);assert.equal(h.calls.length,0);});
test('withheld site permission fails inline and never opens a permission window',async()=>{const h=harness({granted:false});assert.match((await h.send('capture',{tabs:[h.tabs[0]]})).error,/On all sites/);assert.equal(h.calls.length,0);assert.match((await h.send('permission',{tabs:[h.tabs[0]]})).error,/Unknown/);assert.equal(h.calls.length,0);});
test('all web access is declared at installation without optional per-site permissions',()=>{const manifest=JSON.parse(fs.readFileSync(new URL('../extension/manifest.json',import.meta.url)));assert.deepEqual(manifest.host_permissions,['https://*/*','http://*/*']);assert.equal(manifest.optional_host_permissions,undefined);});
