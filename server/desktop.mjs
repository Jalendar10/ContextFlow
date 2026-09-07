import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
const executable=path.resolve('.contextflow/ContextFlow Helper.app/Contents/MacOS/ContextFlowHelper');
export function validateApp(app){if(!app||!Number.isInteger(app.pid)||app.pid<1||typeof app.bundleId!=='string'||!/^[-\w.]+$/.test(app.bundleId))throw Error('Select a running application.');return app;}
export class Desktop {
 constructor({ai,store,run=exec,launch=spawn,binary=executable}={}){this.ai=ai;this.store=store;this.run=run;this.launch=launch;this.binary=binary;this.session=null;}
 async helper(args){
  if(!existsSync(this.binary))throw Error('Desktop helper is not built. Run npm run build:native on this Mac.');
  let output;
  try{output=(await this.run(this.binary,args,{timeout:25000,maxBuffer:9*1024*1024})).stdout;}catch(e){try{const data=JSON.parse(e.stdout?.trim());if(data.error)throw Error(data.error);}catch(parsed){if(parsed.name!=='SyntaxError'&&parsed.message)throw parsed;}throw Error('Desktop helper did not respond. Check macOS permissions and try again.');}
  const data=JSON.parse(output.trim());if(data.error)throw Error(data.error);return data;
 }
 async status(){if(process.platform!=='darwin'||!existsSync(this.binary))return {available:false,apps:[],error:'Build the macOS helper with npm run build:native.'};return this.helper(['status']);}
 async permission(kind){if(!['accessibility','audio'].includes(kind))throw Error('Unknown desktop permission.');return this.helper(['permission',kind]);}
 async capture(app,sourceId){validateApp(app);const data=await this.helper(['capture',String(app.pid),app.bundleId]);return this.store.put({...data,sourceId,url:`contextflow-app://${app.bundleId}/${app.pid}`,transport:'app',appPid:app.pid,bundleId:app.bundleId});}
 view(){const s=this.session;if(!s)return {active:false};return {id:s.id,active:s.active,starting:s.starting,stopping:s.stopping,processing:s.pending,app:s.app,startedAt:s.startedAt,provider:s.selection.provider,model:s.selection.model,text:s.text,error:s.error,sourceId:s.sourceId,microphone:s.microphone};}
 async start(app,microphone=false){
  validateApp(app);if(this.session&&(this.session.active||this.session.pending))throw Error('Stop the current audio session and wait for transcription to finish.');
  if(!existsSync(this.binary))throw Error('Build the macOS helper first.');
  const settings=await this.ai.settings(),selection={...settings.transcription};
  if(!settings.providers.find(p=>p.id===selection.provider)?.hasKey)throw Error('Add a transcription API key in Models & API keys before listening.');
  const catalog=await this.ai.catalog(selection.provider);if(!catalog.transcription.includes(selection.model))throw Error('Choose an available transcription model first.');
  const apps=(await this.status()).apps;const selected=apps.find(a=>a.pid===app.pid&&a.bundleId===app.bundleId);if(!selected)throw Error('The app closed or restarted. Refresh the app list.');
  const root=path.resolve('.contextflow/audio');await mkdir(root,{recursive:true,mode:0o700});const directory=await mkdtemp(path.join(root,'session-'));
  const s={id:randomUUID(),active:true,starting:true,stopping:false,pending:0,app:selected,selection,microphone,startedAt:new Date().toISOString(),text:'',error:null,sourceId:null,directory,chain:Promise.resolve(),controller:new AbortController()};this.session=s;
  const child=this.launch(this.binary,['record',String(app.pid),app.bundleId,directory,String(microphone)],{stdio:['pipe','pipe','pipe']});s.child=child;let buffer='';
  child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);try{this.event(s,JSON.parse(line))}catch{s.error='Invalid desktop audio response.';this.stop();}}});
  child.stderr.resume();
  child.stdin.on('error',()=>{});
  child.on('error',()=>{s.error='Could not start the desktop helper.';s.active=false;s.starting=false;});
  child.on('close',code=>{s.active=false;s.starting=false;s.stopping=false;clearTimeout(s.stopTimer);clearTimeout(s.limitTimer);if(code&&!s.error)s.error='Audio capture stopped unexpectedly. Check macOS audio permissions.';s.chain.finally(()=>rm(directory,{recursive:true,force:true}));});
  // No indefinite unattended recording: a visible session ends after two hours or a backend restart.
  s.limitTimer=setTimeout(()=>{s.error='The two-hour listening session ended. Start a new session to continue.';this.stop();},2*60*60*1000);s.limitTimer.unref();
  return this.view();
 }
 event(s,data){
  if(data.event==='started'){s.starting=false;return;}
  if(data.error){s.error=String(data.error).slice(0,1000);this.stop();return;}
  if(data.event!=='chunk')return;
  if(typeof data.path!=='string'||!/^[-\w]+\.wav$/.test(data.path))throw Error('Invalid audio path.');
  const filename=path.join(s.directory,data.path);
  if(s.pending>=8){s.error='Transcription is falling behind. Recording stopped to prevent an unbounded audio queue.';rm(filename,{force:true});this.stop();return;}
  s.pending++;
  s.chain=s.chain.then(async()=>{
   try{
    if(s.discard)return;
    const audio=await readFile(filename);const result=await this.ai.transcribe({buffer:audio,filename:data.path,type:'audio/wav',selection:s.selection,signal:s.controller.signal});
    if(!s.discard&&result.text.trim()){
     s.text+=`${s.text?'\n\n':''}[${new Date().toLocaleTimeString()} · ${data.track==='microphone'?'Microphone':s.app.name}]\n${result.text.trim()}`;
     if(s.sourceId&&!this.store.sources.has(s.sourceId)){s.error='Transcript source was deleted; listening stopped.';this.stop();return;}
     const source=this.store.put({sourceId:s.sourceId||undefined,url:`contextflow-audio://${s.id}/transcript`,transport:'audio',title:s.app.name+' — Live transcript',text:s.text,warnings:['Automatic transcription can contain errors. Review against the original conversation. Audio is processed in approximately 15-second chunks.']});s.sourceId=source.id;
    }
   }catch(e){s.error=e.message;this.stop();}finally{await rm(filename,{force:true});s.pending--;}
  });
 }
 discard(sourceId){const s=this.session;if(s&&(!sourceId||s.sourceId===sourceId)){s.discard=true;s.controller.abort();this.stop();}}
 stop(){const s=this.session;if(s?.active&&!s.stopping){s.stopping=true;s.child.stdin.write('stop\n');s.stopTimer=setTimeout(()=>s.child.kill('SIGTERM'),7000);s.stopTimer.unref();}return this.view();}
 dispose(){const s=this.session;if(s){s.controller.abort();s.child?.kill('SIGTERM');clearTimeout(s.limitTimer);clearTimeout(s.stopTimer);}}
}
