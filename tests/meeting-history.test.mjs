import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MeetingHistory} from '../server/meeting-history.mjs';
test('meeting archive survives restart, keeps all turns and rejects path traversal',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cf-history-'));
 try{const history=new MeetingHistory(directory);const id='12345678-1234-1234-1234-123456789abc';const data={id,source:{name:'Meeting'},startedAt:'2026-09-06',turns:Array.from({length:200},(_,i)=>({text:String(i)})),questions:[{text:'Question',answer:'Answer'}]};history.save(data);const restarted=new MeetingHistory(directory);assert.deepEqual(restarted.get(id),data);assert.equal(restarted.list()[0].turns,200);if(process.platform!=='win32')assert.equal(fs.statSync(history.file(id)).mode&0o777,0o600);assert.throws(()=>history.get('../../secret'));history.remove(id);assert.deepEqual(history.list(),[]);}finally{fs.rmSync(directory,{recursive:true,force:true})}
});
