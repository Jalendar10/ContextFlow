// Reconnect reopened pages without substituting an unrelated tab or stale capture.
export function resolveSourceTab(source,tabs){
 const readable=tabs.filter(tab=>/^https?:\/\//.test(tab.url||''));
 const original=readable.find(tab=>tab.id===source.tabId);
 if(original)return {...original,sourceId:source.id,followNavigation:true};
 const matches=readable.filter(tab=>tab.url===source.url);
 if(matches.length===1)return {...matches[0],sourceId:source.id,followNavigation:false};
 const name=source.name||'Selected page';
 if(matches.length>1)throw Error(`“${name}” is open in multiple tabs. Choose the intended tab in Browser tabs and capture it again.`);
 throw Error(`“${name}” is not available in this connected browser. Reopen that page and retry, or choose it in Browser tabs. To answer from the saved content instead, turn off “Refresh sources before answering”.`);
}
