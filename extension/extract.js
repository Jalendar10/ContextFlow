// Serialized by chrome.scripting; keep this function self-contained.
// All transformations happen in strings. Source DOM, scroll and focus remain untouched.
export function extractPage() {
  const warnings=new Set(),headings=[],links=[],tables=[];
  const skip='script,style,noscript,input,select,svg,canvas,template,[hidden],[aria-hidden="true"]';
  const visited=new WeakSet();
  const codeBlock=value=>{const runs=String(value).match(/`+/g)||[];const fence='`'.repeat(Math.max(3,...runs.map(r=>r.length+1)));return '\n\n'+fence+'\n'+value+'\n'+fence+'\n\n';};
  const txt=node=>(node.innerText||node.textContent||'').trim();
  const inline=node=>txt(node).replace(/\s+/g,' ').replace(/\|/g,'\\|');
  function walk(node){
    if(node.nodeType===3)return node.textContent.replace(/\s+/g,' ');
    if(node.nodeType!==1&&node.nodeType!==11&&node.nodeType!==9)return '';
    if(visited.has(node))return '';visited.add(node);
    if(node.matches?.(skip))return '';
    const tag=node.tagName?.toLowerCase();
    if(tag==='textarea'){
      if(node.matches('[autocomplete="current-password"],[autocomplete="new-password"]'))return '';
      const value=node.value;
      return value?.trim()?codeBlock(value):'';
    }
    // Read only rendered editor DOM. No page-world scripts or private editor model access.
    if(node.matches?.('.monaco-editor,.cm-editor,.CodeMirror,.ace_editor')){
      const selectors=node.matches('.monaco-editor')?'.view-lines > .view-line':node.matches('.cm-editor')?'.cm-content > .cm-line':node.matches('.CodeMirror')?'.CodeMirror-code pre':'.ace_text-layer .ace_line';
      const lines=[...node.querySelectorAll(selectors)].filter(line=>!line.closest('[hidden],[aria-hidden="true"]'));
      warnings.add('Editor capture includes only code exposed in the rendered page. Virtualized or protected editor content may be missing; use the editor’s supported copy/export for the full file.');
      if(lines.length)return codeBlock(lines.map(line=>(line.textContent||'').replace(/\u00a0/g,' ')).join('\n'));
    }
    if(tag==='iframe'){
      try{if(node.contentDocument?.body)return '\n\n'+walk(node.contentDocument.body)+'\n\n';}catch{}
      warnings.add('An embedded frame could not be read because it belongs to another origin.');return '';
    }
    if(tag==='pre')return '\n\n```\n'+txt(node).replace(/```/g,'` ` `')+'\n```\n\n';
    if(tag==='table'){
      const rows=[...node.rows].map(r=>[...r.cells].map(inline));
      if(!rows.length)return '';
      tables.push({caption:node.caption?txt(node.caption):'',rows});
      const width=Math.max(...rows.map(r=>r.length));
      const normalize=r=>'| '+Array.from({length:width},(_,i)=>r[i]||'').join(' | ')+' |';
      return '\n\n'+(node.caption?txt(node.caption)+'\n\n':'')+normalize(rows[0])+'\n'+normalize(Array(width).fill('---'))+'\n'+rows.slice(1).map(normalize).join('\n')+'\n\n';
    }
    if(tag==='a'){
      const label=txt(node);let url;
      try{url=new URL(node.getAttribute('href'),location.href);if(!['http:','https:'].includes(url.protocol))return label;}catch{return label;}
      if(label){links.push({text:label,url:url.href});return '['+label.replace(/[[\]]/g,'')+']('+url.href.replace(/\)/g,'%29')+')';}return '';
    }
    const children=[...node.childNodes].map(walk).join('');
    const shadow=node.shadowRoot?'\n\n'+walk(node.shadowRoot):'';
    if(/^h[1-6]$/.test(tag)){headings.push({level:Number(tag[1]),text:txt(node)});return '\n\n'+'#'.repeat(Number(tag[1]))+' '+children.trim()+'\n\n'+shadow;}
    if(tag==='br')return '\n';
    if(tag==='li')return '\n- '+children.trim()+shadow;
    if(tag==='strong'||tag==='b')return '**'+children+'**'+shadow;
    if(tag==='code')return '`'+children+'`'+shadow;
    if(['p','div','section','article','main','header','footer','nav','aside','ul','ol','blockquote','tr'].includes(tag))return '\n\n'+children.trim()+shadow+'\n\n';
    return children+shadow;
  }
  const markdown=walk(document.body||document.documentElement).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(!markdown)throw new Error('This tab contains no readable document content. Browser PDF viewers and protected pages may require an export.');
  if(document.querySelector('[aria-rowcount],[data-virtualized],.monaco-editor,.cm-editor'))warnings.add('This page uses a virtualized grid or editor. Only rows or code currently loaded in the DOM are readable; use the page’s export for the complete dataset.');
  if(document.querySelector('canvas,video'))warnings.add('Canvas, image and video contents are not text and were not transcribed.');
  const advertised=[...document.querySelectorAll('[aria-rowcount]')].map(e=>Number(e.getAttribute('aria-rowcount'))).filter(Number.isFinite);
  return {title:document.title,url:location.href,text:markdown,format:'markdown',headings,links:[...new Map(links.map(l=>[l.url,l])).values()],tables,warnings:[...warnings],stats:{characters:markdown.length,words:markdown.split(/\s+/).length,headings:headings.length,tables:tables.length,rows:tables.reduce((n,t)=>n+t.rows.length,0),advertisedRows:advertised.length?Math.max(...advertised):null}};
}
