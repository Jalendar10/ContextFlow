import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePrefix,wordGutters} from '../source-word-budget.js';
import {ContextStore,answerQuestion} from '../server/context-store.mjs';
test('gutters show block count and cumulative count',()=>{
 const tree={children:[{type:'paragraph',children:[{type:'text',value:'one two three four'}]},{type:'paragraph',children:[{type:'text',value:'one two three four five six seven eight nine ten'}]}]};
 wordGutters()(tree);
 assert.equal(tree.children[0].data.hProperties['data-words'],'4');
 assert.equal(tree.children[0].data.hProperties['data-total'],'4');
 assert.equal(tree.children[1].data.hProperties['data-words'],'10');
 assert.equal(tree.children[1].data.hProperties['data-total'],'14');
});
test('prefix counts cleaned text and never includes words beyond budget',()=>{
 assert.equal(sourcePrefix('[Home](https://example.com)\n\nOne two three four five.',4),'One two three four');
});
test('answer provider receives bounded source prefix even when question matches later content',async()=>{
 const store=new ContextStore(),source=store.put({url:'https://example.com',text:'one two three four SECRET',title:'Test'});
 let received;
 const result=await answerQuestion(store,{question:'What is SECRET?',sourceIds:[source.id],wordLimit:4},{ai:{generate:async args=>{received=args;return {answer:'Not in supplied context'}}}});
 assert.equal(received.evidence[0].text,'one two three four');
 assert.equal(result.usedWords,4);assert.equal(result.wordLimit,4);
 await assert.rejects(answerQuestion(store,{question:'q',sourceIds:[source.id],wordLimit:0},{}),/word limit/);
});
test('formatted statistics match cleaned content instead of original markdown',async()=>{
 const {formattedStats}=await import('../source-word-budget.js');
 const stats=formattedStats('# Main\n\nOne two three.\n\n## Comments\n\nUnwanted response words here.');
 assert.equal(stats.words,4);assert.equal(stats.headingCount,1);assert.equal(stats.tableCount,0);
});
test('cleanup options restore excluded discussion and update the model prefix',()=>{
 const md='Main content.\n\n## Comments\n\nA useful reader response.';
 assert.equal(sourcePrefix(md,100),'Main content.');
 assert.match(sourcePrefix(md,100,{discussions:false}),/reader response/);
 assert.match(sourcePrefix('[Home](https://example.com)\n\nMain',100,{links:false,navigation:false}),/Home/);
});
test('unchecked repeated-content option keeps both blocks',()=>{
 const line='This is a long paragraph that appears twice in the source.';
 assert.equal(sourcePrefix(line+'\n\n'+line,100,{duplicates:false}),line+'\n'+line);
});
test('research answers forward prior conversation and stream deltas with source budget',async()=>{
 const store=new ContextStore(),source=store.put({url:'https://example.com',text:'Current source text.',title:'Test'});
 const history=[{role:'user',content:'Write code'},{role:'assistant',content:'def solve(): return 42'}],deltas=[];
 await answerQuestion(store,{question:'Explain that code',sourceIds:[source.id],history},{onDelta:d=>deltas.push(d),ai:{generate:async args=>{
  assert.deepEqual(args.history,history);assert.equal(args.latencySensitive,true);
  args.onDelta('The function ');args.onDelta('returns 42.');
  return {answer:'The function returns 42.'};
 }}});
 assert.deepEqual(deltas,['The function ','returns 42.']);
});
