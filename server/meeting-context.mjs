export function meetingContext(value={}){
 if(!value||typeof value!=='object')throw Error('Invalid meeting context.');
 const text=(v,max)=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>max)throw Error('Meeting context exceeds its text limit.');return v;};
 if(value.files!==undefined&&(!Array.isArray(value.files)||value.files.length>5))throw Error('Attach up to five text files.');
 const data={content:text(value.content,30000),additionalContent:text(value.additionalContent,30000),prompt:text(value.prompt,8000),files:(value.files||[]).map(f=>({name:text(f.name,200),text:text(f.text,100000)}))};
 if(JSON.stringify(data).length>100000)throw Error('Combined meeting context must be under 100,000 characters. Shorten the content or files.');return data;
}
