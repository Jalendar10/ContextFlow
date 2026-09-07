export function browserRequest(command,payload={},signal){
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();
  const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',cancel);};
  const cancel=()=>{cleanup();reject(new Error('Capture canceled.'));};
  const receive=event=>{
   if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='contextflow:response'||event.data.id!==id)return;
   cleanup();event.data.result?.error?reject(new Error(event.data.result.error)):resolve(event.data.result);
  };
  const timer=setTimeout(()=>{cleanup();reject(new Error(command==='ping'?'Browser extension not connected.':'The browser did not respond. Reload the ContextFlow extension and this page, then try again.'));},command==='ping'?1500:60000);
  if(signal?.aborted){cancel();return;}
  signal?.addEventListener('abort',cancel,{once:true});window.addEventListener('message',receive);
  window.postMessage({channel:'contextflow:request',id,command,payload},location.origin);
 });
}
export async function captureTabs(tabs,{signal,onStatus=()=>{}}={}){
 const installed=await browserRequest('ping',{},signal);
 if(Number.parseInt(installed.version,10)<3)throw Error('Reload the ContextFlow extension v3, set Site access to On all sites, then refresh this page. The old extension still uses per-site permissions.');
 onStatus('Reading current content from selected tabs…');
 return browserRequest('capture',{tabs},signal);
}
