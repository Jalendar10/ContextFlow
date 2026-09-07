import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingDetails} from '../meeting-details.js';
test('meeting details normalize defaults and reject invalid fields',()=>{assert.equal(meetingDetails().type,'');assert.equal(meetingDetails({role:' Engineer '}).role,'Engineer');assert.throws(()=>meetingDetails({type:'invalid'}),/type/);assert.throws(()=>meetingDetails({notes:'a'.repeat(6001)}),/6000/);assert.throws(()=>meetingDetails({company:{}}),/company/);});
