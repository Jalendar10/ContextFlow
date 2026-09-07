import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MeetingRecording} from '../server/meeting-recording.mjs';
test('recording preserves overlapping microphone and meeting samples in playable WAV',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cf-wav-'));try{const file=path.join(dir,'record.wav'),r=new MeetingRecording(file);r.positions={meeting:0,microphone:0};const audio=Buffer.alloc(4);audio.writeInt16LE(1000,0);audio.writeInt16LE(-1000,2);r.write('meeting',audio);r.write('microphone',audio);r.close();const b=fs.readFileSync(file);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(40),8);assert.equal(b.readInt16LE(44),1000);assert.equal(b.readInt16LE(46),1000);assert.equal(b.readInt16LE(50),-1000);if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o600);}finally{fs.rmSync(dir,{recursive:true,force:true})}});
