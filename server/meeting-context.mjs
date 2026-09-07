export function meetingContext(value={}){
 if(!value||typeof value!=='object')throw Error('Invalid meeting context.');
 const text=(v,max)=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>max)throw Error('Meeting context exceeds its text limit.');return v;};
 if(value.files!==undefined&&(!Array.isArray(value.files)||value.files.length>5))throw Error('Attach up to five text files.');
 const data={content:text(value.content,30000),additionalContent:text(value.additionalContent,30000),prompt:text(value.prompt,8000),files:(value.files||[]).map(f=>({name:text(f.name,200),text:text(f.text,100000)}))};
 if(value.inputs!==undefined){if(!value.inputs||typeof value.inputs!=='object')throw Error('Invalid document inputs.');data.inputs={};for(const key of ['content','additionalContent']){const input=value.inputs[key];if(input){if(!['content','file'].includes(input.mode))throw Error('Invalid document input type.');data.inputs[key]={mode:input.mode,name:text(input.name,200)};}}}
 if(JSON.stringify(data).length>100000)throw Error('Combined meeting context must be under 100,000 characters. Shorten the content or files.');return data;
}
