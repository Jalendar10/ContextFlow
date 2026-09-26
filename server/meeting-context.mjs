export function meetingContext(value={}){
 if(!value||typeof value!=='object')throw Error('Invalid meeting context.');
 const text=(v,max,label='Reference text')=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>max)throw Error(`${label} must be text under ${max.toLocaleString()} characters.`);return v;};
 if(value.files!==undefined&&(!Array.isArray(value.files)||value.files.length>30))throw Error('Attach up to 30 reference files.');
 const data={content:text(value.content,300000,'Job description / content'),additionalContent:text(value.additionalContent,300000,'Résumé / additional content'),workProjects:text(value.workProjects,300000,'Work projects'),prompt:text(value.prompt,16000,'Answer prompt'),files:(value.files||[]).map(f=>({name:text(f.name,200),path:text(f.path,1000),purpose:text(f.purpose,1000),text:text(f.text,100000)}))};
 if(value.inputs!==undefined){if(!value.inputs||typeof value.inputs!=='object')throw Error('Invalid document inputs.');data.inputs={};for(const key of ['content','additionalContent']){const input=value.inputs[key];if(input){if(!['content','file'].includes(input.mode))throw Error('Invalid document input type.');data.inputs[key]={mode:input.mode,name:text(input.name,200)};}}}
 if(JSON.stringify(data).length>1000000)throw Error('Combined meeting context must be under 1,000,000 characters. Shorten the content or files.');return data;
}
