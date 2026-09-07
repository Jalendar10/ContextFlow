import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSourceTab} from '../browser-source.js';
const source={id:'saved',tabId:1,url:'https://example.com/problem',name:'Problem'};
test('follows navigation in the selected tab',()=>{
 assert.deepEqual(resolveSourceTab(source,[{id:1,url:'https://example.com/next'}]),{id:1,url:'https://example.com/next',sourceId:'saved',followNavigation:true});
});
test('reconnects a reopened exact page and retains the source ID',()=>{
 assert.deepEqual(resolveSourceTab(source,[{id:8,url:source.url}]),{id:8,url:source.url,sourceId:'saved',followNavigation:false});
});
test('never substitutes another page or ambiguously chooses duplicate tabs',()=>{
 assert.throws(()=>resolveSourceTab(source,[{id:2,url:'https://example.com/other'}]),/saved content/);
 assert.throws(()=>resolveSourceTab(source,[{id:2,url:source.url},{id:3,url:source.url}]),/multiple tabs/);
 assert.throws(()=>resolveSourceTab(source,[{id:1,url:'chrome://settings'}]),/not available/);
});
