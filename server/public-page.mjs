import dns from 'node:dns/promises';
import net from 'node:net';
import {Agent,fetch as safeFetch} from 'undici';
import {JSDOM} from 'jsdom';
import {extractPage} from '../extension/extract.js';
export function isPublicIP(ip){
 if(net.isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);}
 // Public IPv6 global unicast only. IPv4-mapped, local, multicast and reserved addresses fail closed.
 return net.isIP(ip)===6&&/^[23][0-9a-f]{3}:/i.test(ip)&&!/^2001:(db8|0*):/i.test(ip)&&!/^2002:|^3fff:/i.test(ip);
}
export async function capturePublicPage(value,{signal}={}){
 let url=new URL(value);let redirects=0;
 while(true){
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Enter a public HTTP or HTTPS URL without embedded credentials.');
  if(url.port&&!['80','443'].includes(url.port))throw Error('Only standard public web ports are supported. Use the browser extension for internal applications.');
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=net.isIP(hostname)?[{address:hostname,family:net.isIP(hostname)}]:await dns.lookup(hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!isPublicIP(a.address)))throw Error('This URL resolves to a private or reserved address. Use selected-tab capture for internal applications.');
  const pinned=addresses[0];
  const dispatcher=new Agent({connect:{lookup:(_host,options,callback)=>options.all?callback(null,[pinned]):callback(null,pinned.address,pinned.family)}});
  try{
   const response=await safeFetch(url,{dispatcher,redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000),headers:{'User-Agent':'ContextFlow/2.0 (user-requested page capture)','Accept':'text/html,text/plain'}});
   if(response.status>=300&&response.status<400&&response.headers.has('location')){if(++redirects>5)throw Error('Too many redirects.');url=new URL(response.headers.get('location'),url);await response.body?.cancel();continue;}
   if(!response.ok)throw Error(`The page returned HTTP ${response.status}. Use the extension if the page requires a login.`);
   const type=response.headers.get('content-type')||'';
   if(!/text\/html|text\/plain|application\/xhtml\+xml/.test(type))throw Error('This URL is not an HTML or text page. Open it in your browser and use supported page capture.');
   const reader=response.body.getReader(),chunks=[];let bytes=0;
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8*1024*1024){await reader.cancel();throw Error('Public page exceeds the 8 MB download limit.');}chunks.push(value);}
   const html=Buffer.concat(chunks).toString('utf8');
   if(type.includes('text/plain'))return {title:url.hostname,url:url.href,text:html,warnings:['Captured from a public URL; no browser session was used.']};
   const dom=new JSDOM(html,{url:url.href,runScripts:'outside-only'});
   try{const page=dom.window.eval('('+extractPage.toString()+')()');page.warnings.push('Public URL capture does not execute page JavaScript or use browser login cookies. Use tab capture for dynamically rendered content.');return page;}finally{dom.window.close();}
  }finally{await dispatcher.destroy();}
 }
}
