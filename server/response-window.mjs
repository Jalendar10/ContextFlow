import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),windows=new Map();
export async function openResponseWindow(workspace='default'){
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(workspace))throw Error('Invalid workspace.');
 if(windows.has(workspace))return {opened:true,alreadyOpen:true};
 let executable;try{executable=require('electron')}catch{throw Error('Install desktop dependencies with npm install first.')}
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(executable,[fileURLToPath(new URL('../desktop/main.cjs',import.meta.url)),'--workspace='+workspace],{env,stdio:'ignore'});
 windows.set(workspace,child);child.once('exit',()=>windows.delete(workspace));child.once('error',()=>windows.delete(workspace));
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(Error('Could not open the desktop response window.')))});
 return {opened:true};
}
