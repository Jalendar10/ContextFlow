import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
const MAX_BYTES=5*1024*1024;
export async function extractDocument({name,data}={}){
 if(typeof name!=='string'||name.length>200||!(/\.(pdf|docx|doc|txt|md)$/i.test(name)))throw Error('Upload a PDF, Word (.docx or .doc), or text document.');
 if(typeof data!=='string'||data.length>Math.ceil(MAX_BYTES/3)*4||!data.length||!(/^[A-Za-z0-9+/]*={0,2}$/.test(data)))throw Error('Upload a valid document under 5 MB.');
 const buffer=Buffer.from(data,'base64');if(!buffer.length||buffer.length>MAX_BYTES)throw Error('Upload a document under 5 MB.');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL(import.meta.url),{workerData:{name,buffer},resourceLimits:{maxOldGenerationSizeMb:256}});
  const timer=setTimeout(()=>finish(Error('Document extraction timed out. Try a smaller document.')),20000);
  let settled=false;
  function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);}
  worker.once('message',m=>finish(m.error?Error(m.error):null,m.result));worker.once('error',()=>finish(Error('Could not read this document. Try exporting it again.')));worker.once('exit',()=>{if(!settled)finish(Error('Document extraction stopped. Try a smaller document.'));});
 });
}
async function parse({name,buffer}){
 const bytes=Buffer.from(buffer),ext=name.split('.').at(-1).toLowerCase();let text='';
 if(ext==='pdf'){
  if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('This file is not a valid PDF.');
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,verbosity:0});
  try{const pdf=await task.promise;if(pdf.numPages>100)throw Error('Upload a document with at most 100 pages.');
   for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();text+=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('')+'\n\n';page.cleanup();if(text.length>30000)throw Error('Extracted content exceeds 30,000 characters. Upload a shorter document.');}
  }finally{await task.destroy();}
 }else if(ext==='docx'){
  const mammoth=await import('mammoth');text=(await mammoth.default.extractRawText({buffer:bytes})).value;
 }else if(ext==='doc'){
  const {default:WordExtractor}=await import('word-extractor');const doc=await new WordExtractor().extract(bytes);text=[doc.getHeaders(),doc.getBody(),doc.getFootnotes()].filter(Boolean).join('\n');
 }else text=bytes.toString('utf8');
 text=text.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').trim();
 if(!text)throw Error('No readable text found. For scanned PDFs, upload a searchable PDF or paste the résumé text.');
 if(text.length>30000)throw Error('Extracted content exceeds 30,000 characters. Upload a shorter document.');
 return {name,text,words:(text.match(/\S+/g)||[]).length,estimatedTokens:Math.ceil(text.length/4)};
}
if(!isMainThread)parse(workerData).then(result=>parentPort.postMessage({result})).catch(error=>parentPort.postMessage({error:error.name==='PasswordException'?'This PDF is password-protected. Upload an unlocked copy.':/^(Upload|Extracted|No readable|This file)/.test(error.message)?error.message:'Could not read this document. Check that it is a valid, unlocked PDF or Word file.'}));
