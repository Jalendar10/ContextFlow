document.querySelector('#open').onclick=async()=>{
 const matches=await chrome.tabs.query({url:['http://localhost:5173/*','http://127.0.0.1:5173/*']});
 if(matches.length){await chrome.tabs.update(matches[0].id,{active:true});await chrome.windows.update(matches[0].windowId,{focused:true});}
 else await chrome.tabs.create({url:'http://localhost:5173/'});
 window.close();
};

document.querySelector('#responses').onclick=async()=>{const tabs=await chrome.tabs.query({url:['http://localhost:5173/*']});const url=new URL(tabs[0]?.url||'http://localhost:5173/');url.searchParams.set('responses','1');await chrome.tabs.create({url:url.href});window.close()};
