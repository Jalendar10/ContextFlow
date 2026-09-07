import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import cleanFormattedContent from './formatted-content.js';
export function readableText(node){
 if(node.type==='definition')return '';
 if(typeof node.value==='string')return node.value;
 const separator=['root','list','listItem','table','tableRow','blockquote'].includes(node.type)?'\n':'';
 return (node.children||[]).map(readableText).join(separator);
}
export const wordCount=text=>(text.match(/\S+/gu)||[]).length;
export function formattedStats(markdown,cleanup){
 const tree=unified().use(remarkParse).use(remarkGfm).parse(markdown);
 cleanFormattedContent(cleanup)(tree);
 let tables=0,headings=0;
 function visit(node){if(node.type==='table')tables++;if(node.type==='heading')headings++;for(const child of node.children||[])visit(child);}
 visit(tree);const text=readableText(tree);return {words:wordCount(text),tableCount:tables,headingCount:headings,characters:text.length};
}
export function sourcePrefix(markdown,limit,cleanup){
 const tree=unified().use(remarkParse).use(remarkGfm).parse(markdown);
 cleanFormattedContent(cleanup)(tree);
 const text=readableText(tree),matches=[...text.matchAll(/\S+/gu)];
 if(matches.length<=limit)return text;
 const last=matches[limit-1];return text.slice(0,last.index+last[0].length);
}
export function wordGutters(){
 return tree=>{
  let total=0;
  tree.children=tree.children.map(node=>{
   const count=wordCount(readableText(node));total+=count;
   return {type:'wordCountRow',data:{hName:'div',hProperties:{className:['formatted-word-row'],'data-words':String(count),'data-total':String(total),title:count+' words · '+total+' words so far'}},children:[node]};
  });
 };
}
