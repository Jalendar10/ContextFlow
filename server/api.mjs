import {Desktop} from './desktop.mjs';
import {ContextStore,answerQuestion} from './context-store.mjs';
import {ProviderAI} from './providers.mjs';
import {capturePublicPage} from './public-page.mjs';
export function createApi({store=new ContextStore(),ai=new ProviderAI(),publicCapture=capturePublicPage,desktop}={}){
 desktop ||= new Desktop({ai,store});
 const localOrigins=new Set(['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173']);
 return async function api(req,res,next){
  if(!req.url.startsWith('/api/'))return next?.();
  const reply=(status,data)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  let hostname;try{hostname=new URL('http://'+req.headers.host).hostname;}catch{}
  if(!['localhost','127.0.0.1','[::1]'].includes(hostname))return reply(403,{error:'Use the localhost workspace address.'});
  const origin=req.headers.origin;
  const local=localOrigins.has(origin)||(!origin&&req.headers['sec-fetch-site']==='same-origin');
  if(!local)return reply(403,{error:'Open ContextFlow on localhost to access your local workspace.'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort()});
  try{
   const parsed=new URL(req.url,'http://localhost'),path=parsed.pathname;
   if(path==='/api/desktop'&&req.method==='GET')return reply(200,await desktop.status());
   if(path==='/api/desktop/audio'&&req.method==='GET')return reply(200,desktop.view());
   if(path==='/api/desktop/audio'&&req.method==='DELETE')return reply(200,desktop.stop());
   if(path==='/api/settings'&&req.method==='GET')return reply(200,await ai.settings());
   if(path.startsWith('/api/providers/')&&req.method==='GET'){const provider=path.split('/')[3];return reply(200,await ai.catalog(provider,{refresh:parsed.searchParams.get('refresh')==='1'}));}
   if(path.startsWith('/api/providers/')&&req.method==='DELETE')return reply(200,await ai.removeKey(path.split('/')[3]));
   if(path==='/api/transcribe'&&req.method==='POST'){
     if(!req.headers['content-type']?.startsWith('audio/')&&!req.headers['content-type']?.startsWith('video/')&&req.headers['content-type']!=='application/octet-stream')return reply(415,{error:'Audio upload required.'});
     const chunks=[];let size=0;
     for await(const chunk of req){size+=chunk.length;if(size>25_000_000){reply(413,{error:'Audio files must be 25 MB or smaller.'});return;}chunks.push(chunk);}
     const filename=decodeURIComponent(req.headers['x-filename']||'audio.webm').replace(/[/\\]/g,'_').slice(0,200);
     return reply(200,await ai.transcribe({buffer:Buffer.concat(chunks),filename,type:req.headers['content-type'],signal:controller.signal}));
   }
   if(path==='/api/ai'&&req.method==='GET')return reply(200,await ai.status());
   if(path==='/api/sources'&&req.method==='GET')return reply(200,{sources:store.list()});
   if(path==='/api/sources'&&req.method==='DELETE'){desktop.discard();store.sources.clear();return reply(200,{ok:true});}
   const sourceId=path.startsWith('/api/sources/')?path.split('/').pop():null;
   if(sourceId&&req.method==='GET')return reply(200,store.detail(sourceId));
   if(sourceId&&req.method==='DELETE'){desktop.discard(sourceId);store.sources.delete(sourceId);return reply(200,{ok:true});}
   if(!['POST','PUT'].includes(req.method))return reply(404,{error:'Unknown endpoint.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON required.'});
   const parts=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>12*1024*1024){reply(413,{error:'Capture request is too large. Nothing was stored.'});return;}parts.push(chunk);}
   const body=JSON.parse(Buffer.concat(parts).toString());
   if(path==='/api/desktop/permission'&&req.method==='POST')return reply(200,await desktop.permission(body.kind));
   if(path==='/api/desktop/capture'&&req.method==='POST')return reply(200,{source:await desktop.capture(body.app,body.sourceId)});
   if(path==='/api/desktop/audio'&&req.method==='POST')return reply(200,await desktop.start(body.app,body.microphone===true));
   if(path==='/api/connections'&&req.method==='POST')return reply(200,await ai.addConnection(body));
   if(path==='/api/settings'&&req.method==='PUT')return reply(200,await ai.select(body.role,body.provider,body.model));
   if(path.startsWith('/api/providers/')&&req.method==='PUT')return reply(200,await ai.setKey(path.split('/')[3],body.key,body.remember===true));
   if(path==='/api/capture'&&req.method==='POST')return reply(200,{source:store.put(body)});
   if(path==='/api/capture-url'&&req.method==='POST'){
    if(typeof body.url!=='string')throw Error('Enter a URL.');
    const page=await publicCapture(body.url,{signal:controller.signal});return reply(200,{source:store.put({...page,sourceId:body.sourceId})});
   }
   if(path==='/api/selection'&&req.method==='PUT'){store.select(body.ids);return reply(200,{sources:store.list()});}
   if(path==='/api/ai'&&req.method==='PUT')return reply(200,await ai.setModel(body.model));
   if(path==='/api/answer'&&req.method==='POST')return reply(200,await answerQuestion(store,body,{ai,signal:controller.signal}));
   reply(404,{error:'Unknown endpoint.'});
  }catch(error){reply(400,{error:error instanceof SyntaxError?'Invalid JSON.':error.message});}
 };
}
