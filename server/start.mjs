import {createServer} from 'node:http';
import {existsSync,createReadStream,statSync} from 'node:fs';
import path from 'node:path';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const {createApi}=await import('./api.mjs');
const root=path.resolve('dist');
if(!existsSync(path.join(root,'index.html'))){console.error('Run npm run build before starting ContextFlow.');process.exit(1);}
const api=createApi();
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
