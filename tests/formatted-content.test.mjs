import test from 'node:test';
import assert from 'node:assert/strict';
import clean from '../formatted-content.js';
const text=value=>({type:'text',value});
const paragraph=(...children)=>({type:'paragraph',children});
test('formatted cleanup removes navigation and URLs but retains meaningful link labels and code',()=>{
 const tree={type:'root',children:[
 paragraph({type:'link',url:'https://a.test',children:[text('Home')]}),
 paragraph(text('Read '),{type:'link',url:'https://a.test',children:[text('the algorithm')]},text(' for details.')),
 {type:'code',lang:'python',value:'url = "https://example.com"'},
 paragraph(text('https://example.com')),
 {type:'table',children:[{type:'tableRow',children:[{type:'tableCell',children:[text('Value')]}]}]}]};
 clean()(tree);
 assert.equal(tree.children.length,3);
 assert.equal(tree.children[0].children.map(c=>c.value).join(''),'Read the algorithm for details.');
 assert.match(tree.children[1].value,/https:/);
 assert.equal(tree.children[2].type,'table');
});
test('consent section is omitted while the following article section survives',()=>{
 const tree={type:'root',children:[
 {type:'heading',depth:2,children:[text('Manage Consent Preferences')]},
 paragraph(text('Unwanted cookie controls')),
 {type:'heading',depth:2,children:[text('Solution')]},
 paragraph(text('Use a hash table.'))]};
 clean()(tree);assert.equal(tree.children.length,2);assert.equal(tree.children[0].children[0].value,'Solution');
});
test('consecutive repeated sections collapse without changing repeated table rows or code',()=>{
 const heading={type:'heading',depth:2,children:[text('Problem')]},p=paragraph(text('Print a symmetrical alphabet pattern of the requested size.'));
 const code={type:'code',value:'print("a")\nprint("a")'};
 const tree={type:'root',children:[heading,p,structuredClone(heading),structuredClone(p),code]};
 clean()(tree);assert.equal(tree.children.length,3);assert.equal(tree.children[2].value,code.value);
});
test('comments and nested replies are removed up to the next peer section',()=>{
 const tree={type:'root',children:[paragraph(text('Main article.')),
 {type:'heading',depth:2,children:[text('Comments (12)')]},
 paragraph(text('A reader response')),
 {type:'heading',depth:3,children:[text('Replies')]},paragraph(text('Another response')),
 {type:'heading',depth:2,children:[text('Related examples')]},paragraph(text('Useful example.'))]};
 clean()(tree);
 assert.deepEqual(tree.children.map(n=>n.children.map(c=>c.value).join('')),['Main article.','Related examples','Useful example.']);
});
test('plain comment footer is removed without matching prose about code comments',()=>{
 const tree={type:'root',children:[paragraph(text('Code comments explain how this works.')),paragraph(text('32 Comments')),paragraph(text('Sort by newest')),paragraph(text('Reader reply'))]};
 clean()(tree);assert.equal(tree.children.length,1);
});
