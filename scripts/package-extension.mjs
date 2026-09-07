import {execFileSync} from 'node:child_process';
import {mkdirSync,rmSync} from 'node:fs';
mkdirSync('public',{recursive:true});rmSync('public/contextflow-extension.zip',{force:true});
execFileSync('/usr/bin/zip',['-q','-r','../public/contextflow-extension.zip','.'],{cwd:'extension'});
console.log('Packaged ContextFlow browser extension.');
