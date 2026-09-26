const {contextBridge}=require('electron');
contextBridge.exposeInMainWorld('contextflowDesktop',{platform:process.platform,protectionRequested:true});
