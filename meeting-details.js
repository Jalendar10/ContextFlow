export const meetingTypes=['Recruiter screening','Technical interview','Coding interview','System design interview','Behavioral interview','Hiring manager interview','Team meeting','Client meeting','Other'];
export function meetingDetails(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid meeting details.');
 const limits={type:80,title:200,role:200,company:200,participants:1000,notes:6000};const result={};
 for(const [key,max] of Object.entries(limits)){const text=value[key]??'';if(typeof text!=='string'||text.length>max)throw Error(`Meeting ${key} must be under ${max} characters.`);result[key]=text.trim();}
 if(result.type&&!meetingTypes.includes(result.type))throw Error('Select a meeting type.');
 return result;
}
