import fs from 'node:fs';
import path from 'node:path';
export const PROVIDERS={
 elevenlabs:{id:'elevenlabs',name:'ElevenLabs',local:false,roles:['transcription'],env:'ELEVENLABS_API_KEY'},
 deepgram:{id:'deepgram',name:'Deepgram',local:false,roles:['transcription'],env:'DEEPGRAM_API_KEY'},
 ollama:{id:'ollama',name:'Ollama',local:true,roles:['answer']},
 openai:{id:'openai',name:'OpenAI',local:false,roles:['answer','transcription'],env:'OPENAI_API_KEY'},
 anthropic:{id:'anthropic',name:'Anthropic',local:false,roles:['answer'],env:'ANTHROPIC_API_KEY'},
 gemini:{id:'gemini',name:'Google Gemini',local:false,roles:['answer','transcription'],env:'GEMINI_API_KEY'},
 groq:{id:'groq',name:'Groq',local:false,roles:['answer','transcription'],env:'GROQ_API_KEY'}
};
export const TRANSCRIPTION_MODELS={openai:['gpt-transcribe','gpt-4o-transcribe','gpt-4o-mini-transcribe','whisper-1'],groq:['whisper-large-v3-turbo','whisper-large-v3']};
export class ProviderConfig {
 constructor({directory=path.resolve('.contextflow'),env=process.env}={}){
  this.directory=directory;this.env=env;this.sessionKeys=new Map();this.disabledKeys=new Set();
  this.settings={answer:{provider:'ollama',model:env.OLLAMA_MODEL||'gemma4:e4b'},transcription:{provider:'openai',model:'gpt-transcribe'},...this.read('settings.json')};
  this.persisted=this.read('credentials.json');
  this.connections=this.read('connections.json');
 }
 read(name){try{return JSON.parse(fs.readFileSync(path.join(this.directory,name),'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw Error('Stored provider settings could not be read. Check the local settings file.');}}
 write(name,data){
  fs.mkdirSync(this.directory,{recursive:true,mode:0o700});fs.chmodSync(this.directory,0o700);
  const target=path.join(this.directory,name),tmp=target+'.tmp';
  try{fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.chmodSync(tmp,0o600);fs.renameSync(tmp,target);fs.chmodSync(target,0o600);}catch{try{fs.unlinkSync(tmp)}catch{}throw Error('Could not save settings on this computer.');}
 }
 get providers(){return {...PROVIDERS,...this.connections};}
 addConnection({name,baseUrl,transcriptionModels=[]}){
  if(typeof name!=='string'||!name.trim()||name.length>80)throw Error('Enter a provider name of up to 80 characters.');
  let url;try{url=new URL(baseUrl);}catch{throw Error('Enter the API base URL, including https:// and its API path.');}
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw Error('Use HTTPS, or HTTP for a loopback server, without credentials, query or fragment in the URL.');
  if(!Array.isArray(transcriptionModels)||transcriptionModels.length>100||transcriptionModels.some(m=>typeof m!=='string'||!/^[-\w.:/]+$/.test(m)||m.length>200))throw Error('Enter valid transcription model IDs separated by commas.');
  if(Object.keys(this.connections).length>=20)throw Error('At most 20 custom connections are supported.');
  const id='custom-'+crypto.randomUUID();
  const provider={id,name:name.trim(),baseUrl:url.href.replace(/\/$/,''),local:false,roles:['answer','transcription'],custom:true,transcriptionModels};
  const next={...this.connections,[id]:provider};this.write('connections.json',next);this.connections=next;return provider;
 }
 key(provider){if(this.disabledKeys.has(provider))return '';return this.sessionKeys.get(provider)||this.persisted[provider]||this.env[this.providers[provider]?.env]||'';}
 keyInfo(provider){const hasKey=!!this.key(provider);return {hasKey,storage:!hasKey?'none':this.sessionKeys.has(provider)?'session':this.persisted[provider]?'local-file':'environment'};}
 setKey(provider,key,remember=false){
  if(!this.providers[provider]||this.providers[provider].local)throw Error('Choose a cloud API provider.');
  if(typeof key!=='string'||key.trim().length<8||key.length>4096||/[\r\n]/.test(key))throw Error('Enter a valid API key.');
  key=key.trim();const persisted={...this.persisted};
  if(remember){persisted[provider]=key;this.write('credentials.json',persisted);this.sessionKeys.delete(provider);}else{if(persisted[provider]){delete persisted[provider];this.write('credentials.json',persisted);}this.sessionKeys.set(provider,key);}
  this.persisted=persisted;this.disabledKeys.delete(provider);return this.keyInfo(provider);
 }
 removeKey(provider){if(!this.providers[provider])throw Error('Unknown provider.');const next={...this.persisted};if(next[provider]){delete next[provider];this.write('credentials.json',next);}this.persisted=next;this.sessionKeys.delete(provider);this.disabledKeys.add(provider);return this.keyInfo(provider);}
 select(role,provider,model){
  if(!['answer','transcription'].includes(role)||!this.providers[provider]?.roles.includes(role))throw Error('This provider does not support the selected role.');
  if(typeof model!=='string'||!model.trim()||model.length>200||!/^[-\w.:/]+$/.test(model))throw Error('Enter a valid model ID.');
  const next={...this.settings,[role]:{provider,model:model.trim()}};this.write('settings.json',next);this.settings=next;return next;
 }
 public(){return {transcriptionMode:this.settings.transcriptionMode||'streaming',fallback:this.settings.fallback||null,answer:{...this.settings.answer},transcription:{...this.settings.transcription},providers:Object.values(this.providers).map(p=>({id:p.id,name:p.name,roles:p.roles,local:p.local,custom:!!p.custom,baseUrl:p.baseUrl,...this.keyInfo(p.id)}))};}
}
