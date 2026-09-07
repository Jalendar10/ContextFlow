import fs from 'node:fs';
import {MeetingRecording} from './meeting-recording.mjs';
import path from 'node:path';
export class MeetingHistory {
 constructor(directory=path.resolve('.contextflow/meetings')){this.directory=directory;}
 file(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid meeting ID.');return path.join(this.directory,id+'.json');}
 save(data){fs.mkdirSync(this.directory,{recursive:true,mode:0o700});const file=this.file(data.id);fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);}
 get(id){return JSON.parse(fs.readFileSync(this.file(id),'utf8'));}
 list(){if(!fs.existsSync(this.directory))return [];return fs.readdirSync(this.directory).filter(n=>n.endsWith('.json')).map(n=>{const d=this.get(n.slice(0,-5));return {id:d.id,startedAt:d.startedAt,name:d.source.name,turns:d.turns.length,questions:d.questions.length,savedAt:d.savedAt};}).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));}
 recordingFile(id){return this.file(id).replace(/\.json$/,'.wav');}
 record(id){fs.mkdirSync(this.directory,{recursive:true,mode:0o700});return new MeetingRecording(this.recordingFile(id));}
 remove(id){fs.rmSync(this.file(id),{force:true});fs.rmSync(this.recordingFile(id),{force:true});}
}
