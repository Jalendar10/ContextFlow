import React,{useState} from 'react';
export default function CopyButton({text,label='Copy answer'}){
 const [state,setState]=useState('');
 return <span className="copy-control"><button type="button" className="cf-secondary copy-button" onClick={async()=>{try{await navigator.clipboard.writeText(text);setState('Copied!')}catch{setState('Copy failed. Select the text and copy manually.')}}}>{state==='Copied!'?'Copied!':label}</button>{state&&<small role="status">{state==='Copied!'?'':state}</small>}</span>;
}
export function CopyablePre({children}){const text=React.Children.toArray(children).map(child=>React.isValidElement(child)?String(child.props.children??''):String(child)).join('');return <div className="copyable-code"><div className="code-toolbar"><CopyButton text={text.replace(/\n$/,'')} label="Copy code"/></div><pre>{children}</pre></div>}
