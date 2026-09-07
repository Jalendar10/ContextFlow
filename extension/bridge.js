// This bridge runs only inside the local ContextFlow application, never in captured pages.
(() => {
  if(!['5173','4173'].includes(location.port) || window.top!==window)return;
  window.addEventListener('message',async event=>{
    if(event.source!==window || event.origin!==location.origin || event.data?.channel!=='contextflow:request')return;
    const {id,command,payload}=event.data;
    if(typeof id!=='string'||!['ping','tabs','capture','editor-assist'].includes(command))return;
    try {
      const result=await chrome.runtime.sendMessage({channel:'contextflow',command,payload});
      window.postMessage({channel:'contextflow:response',id,result},location.origin);
    }catch(e){window.postMessage({channel:'contextflow:response',id,result:{error:e.message}},location.origin);}
  });
})();
