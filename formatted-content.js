// Presentation-only cleanup. The original capture and citation evidence remain intact.
const textOf=node=>node.value??(node.children||[]).map(textOf).join('');
const chromeLabel=/^(?:home|menu|skip to (?:main )?content|sign in|sign up|log in|log out|subscribe|share|follow|privacy policy|terms (?:of use|of service)|cookie settings|accept all(?: cookies)?|reject all|manage (?:cookies|consent preferences)|confirm my choices|cookie list|strictly necessary cookies|performance cookies|targeting cookies|allow all|back to top)$/i;
const cookieCopy=/^(?:when you visit our website, we store cookies|these cookies (?:are necessary|allow us|may be set)|seems like cookies are disabled|as a (?:california|virginia) consumer, you have the right)/i;
const consentHeading=/^(?:do not sell or share my personal data|manage consent preferences|cookie support is required to access .+)$/i;
const discussionLabel=/^(?:(?:[\d,.]+|all|view all|show all)\s+)?(?:comments?|discussions?|replies|reader comments|user comments|community discussion)(?:\s*\([\d,.]+\)|\s+[\d,.]+)?\s*[:.]?$/i;
const signature=node=>JSON.stringify(node,(key,value)=>key==='position'?undefined:value);
function deduplicateBlocks(nodes){
 const result=[];
 for(let i=0;i<nodes.length;){
  // Remove repeated runs, including their headings, without deduplicating table rows or code lines.
  let repeated=0;
  for(let size=Math.min(30,result.length,nodes.length-i);size>=1;size--){
   const prior=result.slice(-size),next=nodes.slice(i,i+size);
   if(prior.every((n,j)=>signature(n)===signature(next[j]))&&
      (size>1||(['paragraph','heading','list'].includes(next[0].type)&&textOf(next[0]).trim().length>25))){repeated=size;break;}
  }
  if(repeated)i+=repeated;
  else result.push(nodes[i++]);
 }
 return result;
}
export const cleanupDefaults={links:true,navigation:true,cookies:true,discussions:true,duplicates:true};
export function normalizeCleanup(value={}){
 return Object.fromEntries(Object.entries(cleanupDefaults).map(([key,fallback])=>[key,typeof value?.[key]==='boolean'?value[key]:fallback]));
}
export default function cleanFormattedContent(options={}){
 const settings=normalizeCleanup(options);
 return tree=>{
  function clean(node){
   if(['code','inlineCode'].includes(node.type))return node;
   if(node.type==='image'||node.type==='imageReference'||(node.type==='definition'&&settings.links))return null;
   if(node.type==='text'&&settings.links){return {...node,value:node.value.replace(/https?:\/\/[^\s<>]+|www\.[^\s<>]+/g,'')};}
   if(settings.links&&(node.type==='link'||node.type==='linkReference')){
    const label=textOf(node).trim();
    if((settings.navigation&&chromeLabel.test(label))||/^(?:https?:\/\/|www\.)/i.test(label))return null;
    return {type:'text',value:label};
   }
   if(node.children){
    const original=textOf(node).trim();
    if(['paragraph','heading','listItem'].includes(node.type)&&((settings.navigation&&chromeLabel.test(original)&&!/cookie|consent|accept all|reject all|allow all|confirm my choices/i.test(original))||(settings.cookies&&(cookieCopy.test(original)||(/cookie|consent|accept all|reject all|allow all|confirm my choices/i.test(original)&&chromeLabel.test(original))))))return null;
    // Standalone link menus add little to a reading view; keep linked prose in paragraphs.
    if(settings.navigation&&['paragraph','listItem'].includes(node.type)){
     const children=node.type==='listItem'&&node.children.length===1?node.children[0].children:node.children;
     if(children?.some(c=>['link','linkReference'].includes(c.type))&&children.every(c=>['link','linkReference'].includes(c.type)||(c.type==='text'&&/^[\s|·›>/-]*$/.test(c.value))))return null;
    }
    let consentLevel=null,discussionLevel=null;
    node={...node,children:node.children.flatMap(child=>{
     const label=textOf(child).trim();
     if(settings.discussions&&(child.type==='heading'||child.type==='paragraph')&&discussionLabel.test(label)){
      discussionLevel=discussionLevel===null?(child.type==='heading'?child.depth:0):Math.min(discussionLevel,child.type==='heading'?child.depth:0);return [];
     }
     if(discussionLevel!==null){
      if(child.type==='heading'&&discussionLevel>0&&child.depth<=discussionLevel)discussionLevel=null;
      else return [];
     }
     if(settings.cookies&&child.type==='heading'&&consentHeading.test(textOf(child).trim())){consentLevel=child.depth;return [];}
     if(consentLevel!==null){if(child.type==='heading'&&child.depth<=consentLevel&&!/cookie|consent|tracking|advertising/i.test(textOf(child)))consentLevel=null;else return [];}
     const result=clean(child);return result?[result]:[];
    })};
    if(!node.children.length||(!textOf(node).trim()&&!node.children.some(c=>['code','table'].includes(c.type))))return null;
   }
   return node;
  }
  const result=clean(tree);tree.children=settings.duplicates?deduplicateBlocks(result?.children||[]):result?.children||[];
 };
}
