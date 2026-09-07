import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function normalizeUsage(u){if(!u)return null;return {inputTokens:u.input_tokens??u.prompt_tokens??u.promptTokenCount??null,outputTokens:u.output_tokens??u.completion_tokens??(u.candidatesTokenCount===undefined?null:u.candidatesTokenCount+(u.thoughtsTokenCount||0)),cachedTokens:u.input_tokens_details?.cached_tokens??u.prompt_tokens_details?.cached_tokens??u.cachedContentTokenCount??0};}
export class UsageLedger {
 constructor(directory){this.directory=directory;this.file=path.join(directory,'usage.jsonl');this.ratesFile=path.join(directory,'usage-rates.json');}
 rates(){const defaults={'openai/gpt-4o-mini':{input:0.15,output:0.6,cached:0.075,source:'https://developers.openai.com/api/docs/models/gpt-4o-mini',checkedAt:'2026-09-06'}};try{return {...defaults,...JSON.parse(fs.readFileSync(this.ratesFile,'utf8'))}}catch(e){if(e.code==='ENOENT')return defaults;throw e;}}
 setRate(key,rate){if(typeof key!=='string'||key.length>300||!key.includes('/'))throw Error('Choose a provider/model.');for(const name of ['input','output','cached','minute'])if(rate[name]!==undefined&&(!Number.isFinite(rate[name])||rate[name]<0||rate[name]>100000))throw Error('Enter non-negative USD rates.');const rates=this.rates();rates[key]={...rate,source:'User supplied',checkedAt:new Date().toISOString()};fs.mkdirSync(this.directory,{recursive:true,mode:0o700});fs.writeFileSync(this.ratesFile,JSON.stringify(rates),{mode:0o600});}
 record(row){const rate=this.rates()[row.provider+'/'+row.model];let estimatedUsd=null;
  if(row.status==='success'&&row.provider==='ollama')estimatedUsd=0;
  else if(row.status==='success'&&rate){if(row.audioSeconds!=null&&rate.minute!=null)estimatedUsd=row.audioSeconds/60*rate.minute;else if(row.usage?.inputTokens!=null&&row.usage?.outputTokens!=null&&rate.input!=null&&rate.output!=null){const cached=Math.min(row.usage.cachedTokens||0,row.usage.inputTokens);estimatedUsd=((row.usage.inputTokens-cached)*rate.input+cached*(rate.cached??rate.input)+row.usage.outputTokens*rate.output)/1e6;}}
  const item={id:randomUUID(),...row,estimatedUsd,rate:rate||null};fs.mkdirSync(this.directory,{recursive:true,mode:0o700});fs.appendFileSync(this.file,JSON.stringify(item)+'\n',{mode:0o600});return item;
 }
 list(){try{return fs.readFileSync(this.file,'utf8').split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}}).reverse();}catch(e){if(e.code==='ENOENT')return [];throw e;}}
}
