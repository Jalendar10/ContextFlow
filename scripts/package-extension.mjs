import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {zipSync} from 'fflate';
const files={};
function collect(directory,prefix=''){for(const entry of readdirSync(directory,{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const name=prefix+entry.name;if(entry.isDirectory())collect(path.join(directory,entry.name),name+'/');else if(entry.isFile())files[name]=new Uint8Array(readFileSync(path.join(directory,entry.name)));}}
collect('extension');mkdirSync('public',{recursive:true});writeFileSync('public/contextflow-extension.zip',zipSync(files));console.log('Packaged ContextFlow browser extension.');
