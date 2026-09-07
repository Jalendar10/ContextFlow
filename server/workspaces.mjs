import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export class Workspaces {
 constructor(directory){this.directory=directory;this.file=path.join(directory,'workspaces.json');this.items=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):[{id:'default',name:'My workspace'}];}
 list(){return this.items.map(x=>({...x}));}
 create(name){name=String(name||'').trim();if(!name||name.length>80)throw Error('Enter a workspace name between 1 and 80 characters.');if(this.items.length>=30)throw Error('At most 30 workspaces are supported.');if(this.items.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('A workspace already has that name.');const item={id:randomUUID(),name};this.items.push(item);fs.mkdirSync(this.directory,{recursive:true,mode:0o700});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.items),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);return item;}
 get(id){const item=this.items.find(x=>x.id===id);if(!item)throw Error('Workspace not found.');return item;}
 folder(id){this.get(id);return id==='default'?this.directory:path.join(this.directory,'workspaces',id);}
}
