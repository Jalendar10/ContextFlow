// Audio remains local until the meeting's explicitly started upload loop sends these frames.
class MeetingPCM extends AudioWorkletProcessor {
 constructor(){super();this.samples=[];this.phase=0;this.port.onmessage=event=>{if(event.data==='flush'){if(this.samples.length){const pcm=new Int16Array(this.samples.splice(0));this.port.postMessage(pcm.buffer,[pcm.buffer]);}this.port.postMessage({type:'flushed'});}};}
 process(inputs){const channels=inputs[0];if(!channels?.length)return true;const frames=channels[0].length;
  for(let i=0;i<frames;i++){let mono=0;for(const channel of channels)mono+=channel[i]||0;mono/=channels.length;this.phase+=24000/sampleRate;while(this.phase>=1){this.phase-=1;this.samples.push(Math.round(Math.max(-1,Math.min(1,mono))*32767));}}
  if(this.samples.length>=4800){const pcm=new Int16Array(this.samples.splice(0,4800));this.port.postMessage(pcm.buffer,[pcm.buffer]);}return true;
 }
}
registerProcessor('meeting-pcm',MeetingPCM);
