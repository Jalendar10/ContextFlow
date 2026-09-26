const {app,BrowserWindow,session}=require('electron');
const path=require('node:path');
const workspace=process.argv.find(x=>x.startsWith('--workspace='))?.slice(12)||'default';
if(!/^[a-zA-Z0-9-]{1,80}$/.test(workspace))process.exit(1);
const url='http://localhost:5173/?responses=1&workspace='+encodeURIComponent(workspace);
let win;
function open(){
 win=new BrowserWindow({width:560,height:740,minWidth:360,minHeight:300,title:'ContextFlow Responses',alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.setContentProtection(true);
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(event,destination)=>{if(destination!==url)event.preventDefault()});
 win.loadURL(url);
}
app.whenReady().then(()=>{session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));open()});
app.on('window-all-closed',()=>app.quit());
