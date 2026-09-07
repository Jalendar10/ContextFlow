export class BrowserAudio {
 constructor(){this.streams=[];this.nodes=[];this.closed=false;this.queued=0;this.queue=Promise.resolve();this.flushers=[];this.worklets=[];}
 async choose(kind,microphone){
  if(!navigator.mediaDevices?.getDisplayMedia&&['tab','system'].includes(kind))throw Error('Tab audio capture requires Chrome or Edge. Open ContextFlow in that browser.');
  this.context=new AudioContext({sampleRate:24000});
  // Resume during the Start click, before the picker or backend awaits consume activation.
  this.resumePromise=this.context.resume().catch(()=>{});
  if(kind==='tab'||kind==='system'){
   let controller;
   if(globalThis.CaptureController?.prototype?.setFocusBehavior){controller=new CaptureController();controller.setFocusBehavior('no-focus-change');}
   const media=await navigator.mediaDevices.getDisplayMedia({...(controller?{controller}:{}),video:{displaySurface:kind==='system'?'monitor':'browser'},audio:true,systemAudio:kind==='system'?'include':'exclude',selfBrowserSurface:'exclude',surfaceSwitching:'exclude'});this.streams.push(media);
   if(kind==='tab'&&media.getVideoTracks()[0]?.getSettings().displaySurface!=='browser')throw Error('Select a browser tab, not a screen or window. Use app audio for desktop applications.');
   if(!media.getAudioTracks().length)throw Error(kind==='system'?'No system audio was shared. Choose Entire screen and enable system audio in Chrome or Edge.':'No tab audio was shared. Choose the tab and enable Share tab audio in the browser picker.');this.label=media.getVideoTracks()[0].label||'Selected browser tab';this.meeting=media;
  }
  if(kind==='microphone'||microphone){const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});this.streams.push(media);this.microphone=media;if(kind==='microphone')this.label='Microphone';}
 }
 async start(id,onError){
  if(this.closed)throw Error('Audio sharing ended before the session started. Please start again.');
  this.id=id;await this.context.audioWorklet.addModule('/meeting-pcm-worklet.js');
  await Promise.race([this.context.resume(),new Promise((_,reject)=>{this.resumeTimer=setTimeout(()=>reject(Error('Browser paused audio capture. Return to ContextFlow and start again.')),3000)})]).finally(()=>clearTimeout(this.resumeTimer));
  if(this.closed)throw Error('Audio sharing ended before the session started.');
  const attach=(media,track)=>{const source=this.context.createMediaStreamSource(new MediaStream(media.getAudioTracks()));const worklet=new AudioWorkletNode(this.context,'meeting-pcm');const mute=this.context.createGain();mute.gain.value=0;source.connect(worklet);worklet.connect(mute).connect(this.context.destination);this.nodes.push(source,worklet,mute);this.worklets.push(worklet);
   worklet.port.onmessage=event=>{if(event.data?.type==='flushed'){worklet.flushed?.();return;}if(this.closed)return;if(this.queued>=15){onError('Audio upload cannot keep up. Listening stopped.');this.stop();return;}this.queued++;
    this.queue=this.queue.then(async()=>{if(this.closed)return;const response=await fetch('/api/live/audio',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Session-Id':id,'X-Audio-Track':track},body:event.data,signal:AbortSignal.timeout(5000)});if(!response.ok){const data=await response.json();throw Error(data.error||'Audio upload failed.');}}).catch(e=>{if(!this.closed){onError(e.message);this.stop();}}).finally(()=>this.queued--);
   };
   for(const t of media.getTracks())t.addEventListener('ended',()=>{if(!this.closed&&!this.finishing){onError('Browser audio sharing ended.');this.stop();}},{once:true});
  };
  if(this.meeting)attach(this.meeting,'meeting');if(this.microphone)attach(this.microphone,'microphone');
 }
 async finish(){if(this.closed)return;this.finishing=true;this.streams.forEach(s=>s.getTracks().forEach(t=>t.stop()));await Promise.all(this.worklets.map(worklet=>new Promise(resolve=>{const timer=setTimeout(resolve,300);worklet.flushed=()=>{clearTimeout(timer);resolve()};worklet.port.postMessage('flush');})));await this.queue;this.stop();}
 stop(){if(this.closed)return;this.closed=true;this.streams.forEach(s=>s.getTracks().forEach(t=>t.stop()));this.nodes.forEach(n=>n.disconnect());this.context?.close().catch(()=>{});}
}
