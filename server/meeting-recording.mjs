import fs from 'node:fs';
// Independent channels preserve both speakers even when they overlap.
export class MeetingRecording {
 constructor(file){this.fd=fs.openSync(file,'wx+',0o600);this.positions={};this.frames=0;this.started=null;this.header();}
 header(){const b=Buffer.alloc(44);b.write('RIFF');b.writeUInt32LE(36+this.frames*4,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(this.frames*4,40);fs.writeSync(this.fd,b,0,44,0);}
 write(track,pcm){if(this.closed)return;const now=Date.now();this.started??=now;const start=this.positions[track]??Math.max(0,Math.round((now-this.started)*24));const count=pcm.length/2;if(start+count>24000*7205)throw Error('Recording duration limit reached.');const b=Buffer.alloc(count*4);fs.readSync(this.fd,b,0,b.length,44+start*4);const channel=track==='microphone'?2:0;for(let i=0;i<count;i++)b.writeInt16LE(pcm.readInt16LE(i*2),i*4+channel);fs.writeSync(this.fd,b,0,b.length,44+start*4);this.positions[track]=start+count;this.frames=Math.max(this.frames,start+count);this.header();}
 close(){if(this.closed)return;this.closed=true;this.header();fs.fsyncSync(this.fd);fs.closeSync(this.fd);}
}
