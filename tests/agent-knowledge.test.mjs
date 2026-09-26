import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeContext,buildKnowledgeIndex} from '../server/agent-knowledge.mjs';
import {meetingContext} from '../server/meeting-context.mjs';
test('knowledge selection finds late document facts without modifying saved originals',()=>{const c=meetingContext({content:'ordinary background '.repeat(10000),additionalContent:'resume',files:[{name:'incident.txt',text:'routine notes '.repeat(5000)+' latency production outage recovery rollback'}]});const before=JSON.stringify(c),r=knowledgeContext(c,'production outage rollback',4000);assert.match(r.files[0].text,/outage/);assert.equal(JSON.stringify(c),before);assert.ok(r.knowledgeSelection)});
test('small references pass through and prompt error identifies the field',()=>{const c=meetingContext({prompt:'x'.repeat(9000)});assert.equal(knowledgeContext(c,'test'),c);assert.throws(()=>meetingContext({prompt:'x'.repeat(16001)}),/Answer prompt/)});

test("saved index identifies code symbols and preserves file mappings",()=>{const c=meetingContext({files:[{name:"solve.py",purpose:"implements problem.pdf",text:"def solve():\n    return 42"}]});const index=buildKnowledgeIndex(c);assert.deepEqual(index.documents[0].symbols,["solve"]);assert.equal(index.documents[0].purpose,"implements problem.pdf");assert.equal(index.hash,buildKnowledgeIndex(c).hash);assert.notEqual(index.hash,buildKnowledgeIndex({...c,files:[]}).hash)});
