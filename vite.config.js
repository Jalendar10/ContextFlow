import {defineConfig,loadEnv} from 'vite';
import {createApi} from './server/api.mjs';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 for(const key of ['OLLAMA_MODEL','OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GROQ_API_KEY','DEEPGRAM_API_KEY'])if(env[key])process.env[key]=env[key];
 const api=createApi();
 return {server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.contextflow/**']}},preview:{host:'127.0.0.1',port:4173,strictPort:true},plugins:[{name:'contextflow-local-backend',configureServer(server){server.middlewares.use(api)},configurePreviewServer(server){server.middlewares.use(api)}}]};
});
