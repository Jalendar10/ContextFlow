import {createServer} from 'node:http';
import {existsSync,createReadStream,statSync,readFileSync,unlinkSync} from 'node:fs';
import path from 'node:path';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const {createApi}=await import('./api.mjs');
const root=path.resolve('dist');
if(!existsSync(path.join(root,'index.html'))){console.error('Run npm run build before starting ContextFlow.');process.exit(1);}
const {ContextStore}=await import('./context-store.mjs');
const store=new ContextStore();
// Explicit, one-time local restart handoff; never expose a restoration API or retain the snapshot.
if(process.env.CONTEXTFLOW_RESTORE_ONCE==='1'){
 const snapshotPath=path.resolve('.contextflow/restart-context.json');
 const snapshots=JSON.parse(readFileSync(snapshotPath,'utf8'));
 for(const saved of snapshots){const added=store.put({...saved,sourceId:undefined,title:saved.name});const restored=store.sources.get(added.id);store.sources.delete(added.id);for(const key of ['id','capturedAt','revision','on','tableCount','rowCount'])restored[key]=saved[key];store.sources.set(restored.id,restored);}
 unlinkSync(snapshotPath);delete process.env.CONTEXTFLOW_RESTORE_ONCE;
}
const api=createApi({store});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.zip':'application/zip','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=createServer((req,res)=>api(req,res,()=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end('Invalid request');}
}));
server.listen(5173,'127.0.0.1',()=>console.log('ContextFlow is running at http://localhost:5173'));
