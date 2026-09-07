import WebSocket from 'ws';
export function wave(pcm){const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);}
export class StreamingSpeech {
 constructor({ai,key,model,track,onText,onError,Socket=WebSocket}){this.ledger=ai?.usage;this.model=model;this.startedAt=new Date().toISOString();this.started=Date.now();this.bytesSent=0;this.onText=onText;this.onError=onError;this.track=track;this.closed=false;this.pending=[];this.seen=new Set();
  const params=new URLSearchParams({model,encoding:'linear16',sample_rate:'24000',channels:'1',diarize_model:'latest',interim_results:'true',smart_format:'true',endpointing:'500',utterance_end_ms:'1000',vad_events:'true'});
  this.socket=new Socket('wss://api.deepgram.com/v1/listen?'+params,{headers:{Authorization:'Token '+key},handshakeTimeout:12000,maxPayload:2_000_000});
  this.ready=new Promise((resolve,reject)=>{this.socket.once('open',()=>{this.pending.forEach(p=>this.socket.send(p));this.pending=[];this.keepalive=setInterval(()=>{if(this.socket.readyState===1)this.socket.send(JSON.stringify({type:'KeepAlive'}));},4000);this.keepalive.unref();resolve();});this.socket.once('error',()=>reject(Error('Deepgram streaming connection failed. Check your key, permissions and credits.')));this.socket.once('close',()=>reject(Error('Deepgram closed before the stream was ready.')));});
  this.socket.on('message',raw=>{try{this.event(JSON.parse(raw.toString()))}catch{onError('The streaming provider returned an invalid event.');}});
  this.socket.on('error',()=>{if(!this.closed)onError('Deepgram streaming connection failed. Check your key and credits.');});
  this.socket.on('close',()=>{if(!this.usageSaved){this.usageSaved=true;try{this.ledger?.record({provider:'deepgram',model:this.model,kind:'streaming-transcription:'+this.track,startedAt:this.startedAt,durationMs:Date.now()-this.started,status:this.closed?'success':'failed',usage:null,audioSeconds:this.bytesSent/48000});}catch{}}clearInterval(this.keepalive);if(!this.closed)onError('The transcription stream disconnected. Stop and start a new session; audio is not silently dropped.');});
 }
 event(e){if(e.type==='Error'){this.onError('Deepgram rejected the streaming audio request.');return;}if(e.type==='UtteranceEnd'){this.onText({track:this.track,boundary:true});return;}if(e.type!=='Results')return;
  const a=e.channel?.alternatives?.[0];if(!a)return;const text=a.transcript||'';const final=e.is_final===true;
  if(final){const id=String(e.start)+':'+e.duration;if(this.seen.has(id))return;this.seen.add(id);if(this.seen.size>3000)this.seen.delete(this.seen.values().next().value);}
  this.onText({text,words:a.words||[],track:this.track,final,boundary:e.speech_final===true,start:e.start});
 }
 write(pcm){if(this.closed)return;this.bytesSent+=pcm.length;if(this.socket.readyState===1){if(this.socket.bufferedAmount>48000*4)throw Error('Streaming connection cannot keep up with audio.');this.socket.send(pcm);}else{this.pending.push(pcm);if(this.pending.reduce((n,p)=>n+p.length,0)>48000*4)throw Error('Streaming connection did not become ready in time.');}}
 async finish(){if(this.closed)return;this.closed=true;clearInterval(this.keepalive);if(this.socket.readyState===1){this.socket.send(JSON.stringify({type:'CloseStream'}));await new Promise(resolve=>{const timer=setTimeout(()=>{this.socket.terminate();resolve()},2500);this.socket.once('close',()=>{clearTimeout(timer);resolve()});});}else this.socket.terminate();}
 abort(){this.closed=true;clearInterval(this.keepalive);this.socket.terminate();}
}
export class ShortSpeech {
 constructor({ai,selection,track,onText,onError,signal}){Object.assign(this,{ai,selection,track,onText,onError,signal});this.buffers=[];this.bytes=0;this.silent=0;this.speech=false;this.pending=0;this.chain=Promise.resolve();this.ready=Promise.resolve();this.closed=false;}
 write(pcm){if(this.closed)return;let square=0;for(let i=0;i+1<pcm.length;i+=2)square+=(pcm.readInt16LE(i)/32768)**2;const voiced=Math.sqrt(square/Math.max(1,pcm.length/2))>0.007;
  this.buffers.push(pcm);this.bytes+=pcm.length;this.speech ||=voiced;this.silent=voiced?0:this.silent+pcm.length;
  if(this.bytes>=48000*4||(this.speech&&this.silent>=48000*.6&&this.bytes>=48000))this.flush();else if(!this.speech&&this.bytes>48000)this.reset();
 }
 reset(){this.buffers=[];this.bytes=0;this.silent=0;this.speech=false;}
 flush(){if(!this.speech){this.reset();return;}const pcm=Buffer.concat(this.buffers);this.reset();if(this.pending>=3)throw Error('Transcription is falling behind; choose a faster model or streaming provider.');this.pending++;
  this.chain=this.chain.then(async()=>{if(this.signal.aborted)return;try{const r=await this.ai.transcribe({buffer:wave(pcm),filename:'live.wav',type:'audio/wav',selection:this.selection,signal:this.signal});if(r.text.trim())this.onText({track:this.track,text:r.text,words:r.words||[],final:true,boundary:true});}catch(e){if(!this.signal.aborted)this.onError(e.message);}finally{this.pending--;}});
 }
 async finish(){try{this.flush()}catch(e){this.onError(e.message)}this.closed=true;await this.chain;}
 abort(){this.closed=true;this.reset();}
}
