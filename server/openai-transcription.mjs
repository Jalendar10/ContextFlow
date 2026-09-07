import WebSocket from 'ws';
export class OpenAITranscription {
 constructor({ai,key,model,track,onText,onError,Socket=WebSocket}){
  Object.assign(this,{ai,model,track,onText,onError});this.bytes=0;this.uncommitted=0;this.items=new Map();this.order=[];this.finals=new Map();this.completed=new Set();this.started=Date.now();this.closed=false;
  this.socket=new Socket('wss://api.openai.com/v1/realtime?intent=transcription',{headers:{Authorization:'Bearer '+key},handshakeTimeout:12000,maxPayload:2000000});
  this.ready=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;this.timer=setTimeout(()=>{reject(Error('OpenAI streaming setup timed out.'));this.abort()},15000)});
  this.socket.on('open',()=>this.send({type:'session.update',session:{type:'transcription',audio:{input:{format:{type:'audio/pcm',rate:24000},transcription:{model,...(model==='gpt-live-transcribe'?{delay:'low'}:{})},turn_detection:{type:'server_vad',threshold:.5,prefix_padding_ms:300,silence_duration_ms:500}}}}}));
  this.socket.on('message',raw=>{try{this.event(JSON.parse(raw.toString()))}catch{this.onError('Invalid OpenAI transcription event.')}});
  this.socket.on('error',()=>{const error=Error('OpenAI streaming connection failed. Check your key and Realtime model access.');this.reject(error);if(this.connected&&!this.closed)this.onError(error.message)});
  this.socket.on('close',()=>{clearTimeout(this.timer);if(!this.closed){this.reject(Error('OpenAI transcription disconnected.'));if(this.connected)this.onError('OpenAI transcription disconnected. Start a new session.');}this.log();});
 }
 send(event){if(this.socket.readyState===1)this.socket.send(JSON.stringify(event));}
 event(e){if(e.type==='session.updated'){clearTimeout(this.timer);this.connected=true;this.resolve();return;}
  if(e.type==='error'||e.type==='conversation.item.input_audio_transcription.failed'){const message='OpenAI transcription failed for '+this.model+'. Check Realtime model support or select Batch.';this.failed=true;clearTimeout(this.timer);this.reject(Error(message));this.onError(message);return;}
  if(e.type==='input_audio_buffer.committed'){this.uncommitted=0;this.awaitingCommit=false;if(!this.order.includes(e.item_id))this.order.push(e.item_id);this.drain();return;}
  if(e.type==='conversation.item.input_audio_transcription.delta'){const text=(this.items.get(e.item_id)||'')+(e.delta||'');this.items.set(e.item_id,text);this.onText({track:this.track,text,final:false});}
  if(e.type==='conversation.item.input_audio_transcription.completed'){if(this.completed.has(e.item_id))return;this.items.delete(e.item_id);this.finals.set(e.item_id,e.transcript||'');if(!this.order.includes(e.item_id))this.order.push(e.item_id);this.drain();}
 }
 drain(){while(this.order.length&&this.finals.has(this.order[0])){const id=this.order.shift(),text=this.finals.get(id);this.finals.delete(id);this.completed.add(id);this.onText({track:this.track,text,final:true,boundary:true});}this.finished?.();}
 write(pcm){if(this.closed)return;if(!this.connected||this.socket.readyState!==1)throw Error('OpenAI transcription is not connected.');if(this.socket.bufferedAmount>192000)throw Error('OpenAI audio upload cannot keep up.');this.bytes+=pcm.length;this.uncommitted+=pcm.length;this.send({type:'input_audio_buffer.append',audio:pcm.toString('base64')});}
 async finish(){if(this.closed)return;if(this.uncommitted>=4800){this.awaitingCommit=true;this.send({type:'input_audio_buffer.commit'});}await new Promise(resolve=>{const timer=setTimeout(resolve,5000);this.finished=()=>{if(!this.awaitingCommit&&!this.order.length&&!this.items.size){clearTimeout(timer);resolve()}};if(!this.uncommitted&&!this.order.length&&!this.items.size){clearTimeout(timer);resolve()}});this.closed=true;this.socket.close();this.log();}
 abort(){this.aborted=true;this.closed=true;clearTimeout(this.timer);this.socket.terminate();this.log();}
 log(){if(this.logged)return;this.logged=true;try{this.ai?.usage?.record({provider:'openai',model:this.model,kind:'streaming-transcription:'+this.track,startedAt:new Date(this.started).toISOString(),durationMs:Date.now()-this.started,status:this.closed&&!this.aborted&&!this.failed?'success':'failed',usage:null,audioSeconds:this.bytes/48000})}catch{}}
}
