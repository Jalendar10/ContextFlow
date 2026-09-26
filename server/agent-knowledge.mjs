import {createHash} from 'node:crypto';
const indexes=new Map();
export function buildKnowledgeIndex(context){
 const docs=[{name:'Job description',text:context.content},{name:'Résumé',text:context.additionalContent},{name:'Work projects',text:context.workProjects},...(context.files||[])];
 const hash=createHash('sha256').update(JSON.stringify(docs)).digest('hex');if(indexes.has(hash))return indexes.get(hash);
 const result={hash,documents:docs.filter(d=>d.text).map(d=>({name:d.name,path:d.path||d.name,purpose:d.purpose||'',characters:d.text.length,lines:d.text.split('\n').length,chunks:Math.ceil(d.text.length/1200),symbols:[...d.text.matchAll(/(?:def|class|function|interface)\s+([A-Za-z_][\w]*)/g)].slice(0,80).map(m=>m[1])}))};
 if(indexes.size>=50)indexes.delete(indexes.keys().next().value);indexes.set(hash,result);return result;
}
// Keep original documents locally; select excerpts per question without another model call.
export function knowledgeContext(context,question,budget=24000){
 const docs=[['content',context.content],['additionalContent',context.additionalContent],['workProjects',context.workProjects],...(context.files||[]).map((f,i)=>['file:'+i,f.text])];
 if(docs.reduce((n,[,t])=>n+(t||'').length,0)<=budget)return context;
 const index=buildKnowledgeIndex(context);
 const terms=new Set((question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]));
 const chunks=[];for(const [key,text=''] of docs){for(let start=0;start<text.length;start+=1200){const value=text.slice(start,start+1400),file=key.startsWith('file:')?context.files[Number(key.slice(5))]:null,words=new Set((value+' '+(file?.path||file?.name||'')+' '+(file?.purpose||'')).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);chunks.push({key,start,value,score:[...terms].reduce((n,t)=>n+(words.has(t)?1:0),0)+(start===0?0.1:0)})}}
 const chosen=[];let used=0;for(const c of chunks.sort((a,b)=>b.score-a.score)){if(used+c.value.length>budget)continue;chosen.push(c);used+=c.value.length}
 const selected=key=>chosen.filter(c=>c.key===key).sort((a,b)=>a.start-b.start).map(c=>`[Excerpt at character ${c.start}]\n${c.value}`).join('\n\n');
 return {...context,content:selected('content'),additionalContent:selected('additionalContent'),workProjects:selected('workProjects'),files:(context.files||[]).map((f,i)=>({...f,text:selected('file:'+i)})).filter(f=>f.text),knowledgeMap:index.documents,knowledgeSelection:'Relevant excerpts selected locally from all saved documents. Omitted passages are not evidence of absence; ask for a more specific reference if needed.'};
}
