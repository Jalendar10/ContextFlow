const terms=text=>new Set((String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]));
// Extractive memory: never invent or paraphrase candidate history. Originals stay in meeting history.
export function conversationMemory(turns,question,{recentBudget=16000,memoryBudget=8000}={}){
 const entries=turns.map((t,index)=>({id:t.id,index,marked:!!t.considered,text:`${t.speaker}: ${t.text}`}));
 let recent=[],used=0,boundary=entries.length,overflow=null;
 for(let i=entries.length-1;i>=0;i--){const e=entries[i];if(used+e.text.length+1>recentBudget){if(!recent.length){recent=[{...e,text:e.text.slice(-recentBudget)}];boundary=i;overflow={...e,text:e.text.slice(0,-recentBudget)};}break}recent.unshift(e);used+=e.text.length+1;boundary=i;}
 const old=[...entries.slice(0,boundary),...(overflow?[overflow]:[])],query=terms(question),candidates=[];
 for(const e of old){for(let offset=0;offset<e.text.length;offset+=1000){const text=e.text.slice(offset,offset+1000),words=terms(text);const score=[...query].reduce((n,t)=>n+(words.has(t)?1:0),0)+(e.marked?3:0);candidates.push({...e,text,offset,score})}}
 candidates.sort((a,b)=>b.score-a.score||b.index-a.index);
 const selected=[];let size=0;
 for(const c of candidates){const line=`[Earlier turn ${c.index+1}${c.offset?' continued':''}] ${c.text}`;if(size+line.length+1>memoryBudget)continue;selected.push({...c,line});size+=line.length+1;}
 selected.sort((a,b)=>a.index-b.index||a.offset-b.offset);
 return {recent:recent.map(e=>e.text).join('\n'),earlier:selected.map(e=>e.line).join('\n'),rolledOver:old.length>0,archivedTurns:old.length,selectedEarlierTurns:new Set(selected.map(e=>e.id)).size,policy:'Earlier memory contains selected verbatim speech, not a complete summary. Speaker labels distinguish candidate accounts from interviewer statements. Agent answers are not experience evidence. All original turns remain in local meeting history.'};
}
