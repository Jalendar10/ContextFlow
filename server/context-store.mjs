import {createHash,randomUUID} from 'node:crypto';
const MAX_BYTES=8*1024*1024;
const stop=new Set(['the','what','why','how','are','was','this','that','with','from','does','can','for','and','about','our','its','you','use','tell','please','would','could','should']);
const terms=value=>(value.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu)||[]).filter(x=>!stop.has(x));
export class ContextStore {
 sources=new Map();
 put(data){
  if(!data||typeof data.text!=='string'||!data.text.trim())throw Error('The page has no readable content.');
  if(Buffer.byteLength(data.text)>MAX_BYTES)throw Error('Page exceeds the 8 MB capture limit. Nothing was truncated or stored.');
  const url=new URL(data.url);if(!['http:','https:','contextflow-app:','contextflow-audio:'].includes(url.protocol))throw Error('Only HTTP and HTTPS pages are supported.');
  if(url.username||url.password)throw Error('URLs containing credentials are not accepted.');
  const tabId=Number.isInteger(data.tabId)?data.tabId:null;
  const browserKey=typeof data.browserKey==='string'?data.browserKey:null;
  let old=data.sourceId?this.sources.get(data.sourceId):null;
  if(data.sourceId&&!old)throw Error('This source was deleted. Select the tab again.');
  if(old&&old.url!==url.href)throw Error('The page URL changed. Select the new tab content explicitly.');
  if(!old)old=[...this.sources.values()].find(s=>tabId!==null?s.tabId===tabId&&s.browserKey===browserKey&&s.url===url.href:s.tabId===null&&s.url===url.href);
  const text=data.text.trim(),hash=createHash('sha256').update(text).digest('hex');
  const total=[...this.sources.values()].reduce((n,s)=>n+(s.id===old?.id?0:Buffer.byteLength(s.text)),0);
  if(total+Buffer.byteLength(text)>32*1024*1024)throw Error('Local context is full (32 MB). Delete a source before capturing more.');
  const headings=Array.isArray(data.headings)?data.headings.slice(0,2000).filter(h=>typeof h.text==='string').map(h=>({text:h.text.slice(0,1000),level:Number(h.level)||2})):[];
  const links=Array.isArray(data.links)?data.links.filter(l=>typeof l.url==='string'&&/^https?:\/\//.test(l.url)).slice(0,5000).map(l=>({url:l.url,text:String(l.text||l.url).slice(0,1000)})):[];
  const source={id:old?.id||randomUUID(),url:url.href,name:String(data.title||url.hostname).slice(0,500),text,format:'markdown',hash,on:old?.on??true,tabId,browserKey,windowId:data.windowId||null,transport:url.protocol==='contextflow-app:'?'app':url.protocol==='contextflow-audio:'?'audio':tabId===null?'url':'browser',appPid:data.appPid||null,bundleId:data.bundleId||null,capturedAt:new Date().toISOString(),revision:old?(old.hash===hash?old.revision:old.revision+1):1,characters:text.length,words:text.split(/\s+/).length,headings,links,tableCount:Array.isArray(data.tables)?data.tables.length:0,rowCount:Array.isArray(data.tables)?data.tables.reduce((n,t)=>n+(t.rows?.length||0),0):0,warnings:Array.isArray(data.warnings)?data.warnings.map(String).slice(0,30):[],chunks:old?.hash===hash?old.chunks:this.chunk(text)};
  this.sources.set(source.id,source);return this.metadata(source);
 }
 chunk(text){
  const chunks=[];let start=0;
  while(start<text.length){let end=Math.min(start+3500,text.length);if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>start+1500)end=boundary;}chunks.push({text:text.slice(start,end),start});if(end===text.length)break;start=Math.max(start+1,end-200);}
  return chunks;
 }
 metadata({text,chunks,hash,links,headings,...source}){return {...source,linkCount:links.length,headingCount:headings.length};}
 list(){return [...this.sources.values()].map(s=>this.metadata(s));}
 detail(id){const s=this.sources.get(id);if(!s)throw Error('Source not found.');return {...this.metadata(s),text:s.text,links:s.links,headings:s.headings};}
 select(ids){if(!Array.isArray(ids)||ids.some(id=>!this.sources.has(id)))throw Error('Unknown source selection.');for(const s of this.sources.values())s.on=ids.includes(s.id);}
 retrieve(question,ids){
  if(!Array.isArray(ids)||!ids.length)throw Error('Select at least one captured source before asking.');
  if(ids.length>20)throw Error('Select at most 20 sources per answer.');
  if(ids.some(id=>!this.sources.get(id)?.on))throw Error('A selected source was deleted or unshared.');
  const query=[...new Set(terms(question))];
  const all=ids.flatMap(id=>{const s=this.sources.get(id);return s.chunks.map(c=>{const counts=new Map();for(const t of terms(c.text))counts.set(t,(counts.get(t)||0)+1);const score=query.reduce((n,t)=>n+Math.log(1+(counts.get(t)||0)),0);return {...c,score,sourceId:id,title:s.name,url:s.url,capturedAt:s.capturedAt,revision:s.revision};});});
  const total=all.reduce((n,c)=>n+c.text.length,0);
  // Small documents are supplied in full, supporting semantic questions without keyword matches.
  let chosen=all;
  if(total>34000){
    const summary=/\b(summar|overview|explain|describe|compare|analy[sz])/i.test(question);
    const ranked=[...all].sort((a,b)=>b.score-a.score);chosen=[];let used=0;
    const add=c=>{if(c&&!chosen.includes(c)&&used+c.text.length<=34000){chosen.push(c);used+=c.text.length;}};
    for(const id of ids)add(ranked.find(c=>c.sourceId===id));
    if(summary)for(const id of ids){const sourceChunks=all.filter(c=>c.sourceId===id);add(sourceChunks[Math.floor(sourceChunks.length/2)]);add(sourceChunks.at(-1));}
    for(const c of ranked)add(c);
  }
  return chosen.map((c,i)=>({...c,citation:i+1,totalChunks:all.length}));
 }
}
export async function answerQuestion(store,body,{ai,signal}={}){
 if(typeof body.question!=='string'||!body.question.trim()||body.question.length>12000)throw Error('Enter a question of 1–12,000 characters.');
 const history=Array.isArray(body.history)?body.history:[];
 const retrievalQuestion=body.question+' '+history.filter(h=>h.role==='user').slice(-2).map(h=>String(h.content).slice(0,2000)).join(' ');
 const evidence=store.retrieve(retrievalQuestion,body.sourceIds);
 const versions=body.sourceIds.map(id=>store.sources.get(id).hash);
 if(!ai)throw Error('No AI provider is connected. Start Ollama and choose a model.');
 const generated=await ai.generate({question:body.question,evidence,history,signal});
 if(body.sourceIds.some((id,i)=>!store.sources.get(id)?.on||store.sources.get(id).hash!==versions[i]))throw Error('Sources changed while generating the answer. Ask again against the current captures.');
 return {...generated,evidence,createdAt:new Date().toISOString(),usedCharacters:evidence.reduce((n,e)=>n+e.text.length,0),mode:'ai'};
}
