// Opt-in assistance for ordinary, editable textareas. Never hooks protected editor runtimes.
export function editorAssist({code,url,mode}){
 const key='__contextFlowEditorAssist';globalThis[key]?.stop();
 if(mode==='stop')return {ok:true};
 if(location.href!==url)return {error:'The tab navigated. Refresh its source before suggesting code.'};
 const host=document.createElement('div');host.setAttribute('data-contextflow-editor-assist','');
 const shadow=host.attachShadow({mode:'closed'});
 shadow.innerHTML='<style>:host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647}section{font:14px/1.5 system-ui;background:#182333;color:#edf4ff;border:1px solid #7188a3;border-radius:12px;padding:16px;width:340px;box-shadow:0 8px 30px #0006}button{font:inherit;background:#b9d7ff;color:#182333;border:0;border-radius:6px;padding:7px 10px;margin:5px 5px 0 0;cursor:pointer}button:disabled{opacity:.5;cursor:default}pre{white-space:pre-wrap;overflow:auto;max-height:160px;background:#0e1723;padding:8px;font:12px/1.5 monospace}small{display:block;color:#bdcce0;margin:8px 0}</style><section><b>ContextFlow · selected-tab code</b><small class="status"></small><pre></pre><button class="accept">Insert suggestion</button><button class="insert">Insert full code</button><button class="stop">Stop</button></section>';
 document.documentElement.append(host);
 const status=shadow.querySelector('.status'),preview=shadow.querySelector('pre'),accept=shadow.querySelector('.accept'),insert=shadow.querySelector('.insert');
 let target=null,suggestion='',selection=null;
 const supported=el=>el instanceof HTMLTextAreaElement&&!el.disabled&&!el.readOnly&&!el.closest('.monaco-editor,.ace_editor,.CodeMirror,.cm-editor');
 function stop(){clearInterval(timer);document.removeEventListener('focusin',focus,true);document.removeEventListener('input',update,true);document.removeEventListener('selectionchange',update);host.remove();delete globalThis[key];}
 function valid(){if(location.href!==url){stop();return false;}return target?.isConnected&&supported(target);}
 function update(){if(!valid()){accept.disabled=true;insert.disabled=true;status.textContent='Click an editable text area in this tab. Protected and rich code editors are not supported.';return;}
  const start=target.selectionStart,end=target.selectionEnd;selection={value:target.value,start,end};const prefix=target.value.slice(0,start).split('\n').at(-1);
  const matches=code.split('\n').filter(line=>line.startsWith(prefix)&&line.length>prefix.length);
  suggestion=prefix.trim()&&start===end&&matches.length===1?matches[0].slice(prefix.length):'';
  preview.textContent=suggestion||'Type the beginning of a generated code line to see a matching completion.';
  status.textContent='Suggestions come from the code you selected in ContextFlow. Nothing is sent while you type.';accept.disabled=!suggestion;insert.disabled=false;
 }
 function focus(event){if(supported(event.target)){target=event.target;update();}}
 function write(text){if(!valid()||!selection||target.value!==selection.value){update();return;}target.focus();target.setSelectionRange(selection.start,selection.end);target.setRangeText(text,selection.start,selection.end,'end');target.dispatchEvent(new Event('input',{bubbles:true}));update();}
 accept.onclick=()=>write(suggestion);insert.onclick=()=>write(code);shadow.querySelector('.stop').onclick=stop;
 document.addEventListener('focusin',focus,true);document.addEventListener('input',update,true);document.addEventListener('selectionchange',update);
 const timer=setInterval(()=>{if(location.href!==url)stop();},500);globalThis[key]={stop};
 if(supported(document.activeElement))target=document.activeElement;update();return {ok:true};
}
