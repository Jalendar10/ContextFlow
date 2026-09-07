import {editorAssist} from './editor-assist.js';
import {extractPage} from './extract.js';
const allowed=new Set(['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173']);
const validApp=sender=>{try{return sender.id===chrome.runtime.id&&sender.frameId===0&&allowed.has(new URL(sender.url).origin)}catch{return false}};
const validTabs=items=>Array.isArray(items)&&items.length>0&&items.length<=20&&items.every(t=>Number.isInteger(t.id)&&typeof t.url==='string'&&/^https?:/.test(t.url));
async function validate(items){
  if(!validTabs(items))throw Error('Select between 1 and 20 web tabs.');
  for(const item of items){const current=await chrome.tabs.get(item.id);if(current.url!==item.url)throw Error(`“${item.title||'Selected tab'}” navigated to a different page. Re-select the current tab before capturing.`);}
}
async function missingOrigins(items){const origins=[...new Set(items.map(t=>new URL(t.url).origin+'/*'))];const missing=[];for(const origin of origins)if(!await chrome.permissions.contains({origins:[origin]}))missing.push(origin);return missing;}
async function command(message,sender){
 const {command:action,payload={}}=message;
 if(!validApp(sender))throw Error('Requests are accepted only from your local ContextFlow workspace.');
 if(action==='ping')return {version:chrome.runtime.getManifest().version,browser:'Chrome / Edge',connected:true};
 if(action==='tabs'){
   const tabs=await chrome.tabs.query({});
   return {tabs:tabs.filter(t=>/^https?:/.test(t.url||'')&&!allowed.has(new URL(t.url).origin)).map(({id,windowId,title,url})=>({id,windowId,title,url}))};
 }
 if(action==='editor-assist'){
   if(payload.mode!=='stop')throw Error('Editor suggestions have been removed. Use Copy code in ContextFlow.');
   if(typeof payload.code!=='string'||payload.code.length>100000)throw Error('Choose a code block under 100,000 characters.');
   await validate([payload.tab]);if(allowed.has(new URL(payload.tab.url).origin))throw Error('Choose a source tab.');
   if((await missingOrigins([payload.tab])).length)throw Error('Enable extension access for the selected site.');
   const [{result}]=await chrome.scripting.executeScript({target:{tabId:payload.tab.id},world:'ISOLATED',func:editorAssist,args:[{code:payload.code,url:payload.tab.url,mode:payload.mode}]});return result;
 }
 if(action==='capture'){
   await validate(payload.tabs);
   if((await missingOrigins(payload.tabs)).length)throw Error('Website access is disabled in Chrome. Reload ContextFlow extension v3 and set its Site access to On all sites.');
   const results=[];
   for(const item of payload.tabs){
     try{
       await validate([item]);
       const [{result}]=await chrome.scripting.executeScript({target:{tabId:item.id},world:'ISOLATED',func:extractPage});
       if(result.url!==item.url)throw Error('The page navigated during capture. Re-select the tab.');
       results.push({ok:true,page:{...result,tabId:item.id,windowId:item.windowId,browserKey:chrome.runtime.id}});
     }catch(e){results.push({ok:false,title:item.title,error:e.message,tabId:item.id});}
   }
   return {results};
 }
 throw Error('Unknown browser action.');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.channel!=='contextflow')return;
 command(message,sender).then(reply).catch(e=>reply({error:e.message}));return true;
});
