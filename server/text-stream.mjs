// Decode SSE or newline-delimited JSON across arbitrary UTF-8 network boundaries.
export async function readTextStream(response,onEvent,{sse=true}={}){
 const decoder=new TextDecoder();let pending='',data=[];
 const line=value=>{if(!sse){if(value.trim())onEvent(JSON.parse(value));return;}if(!value){if(data.length){const text=data.join('\n');data=[];if(text!=='[DONE]')onEvent(JSON.parse(text));}}else if(value.startsWith('data:'))data.push(value.slice(5).trimStart());};
 for await(const chunk of response.body){pending+=decoder.decode(chunk,{stream:true});if(pending.length>2_000_000)throw Error('Provider stream exceeded the event size limit.');let n;while((n=pending.indexOf('\n'))>=0){line(pending.slice(0,n).replace(/\r$/,''));pending=pending.slice(n+1);}}
 pending+=decoder.decode();if(pending)line(pending.replace(/\r$/,''));if(sse)line('');
}
