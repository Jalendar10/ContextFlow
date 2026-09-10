import {meetingTypes} from './meeting-details.js';
export function interviewProfile(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid interview information.');
 const result={};for(const [key,max] of Object.entries({type:80,interviewer:300,email:300,date:40,timeZone:100,company:200,role:200,emailDetails:10000,expectations:4000,detectedStage:100,stageReason:1000})){
 const text=value[key]??'';if(typeof text!=='string'||text.length>max)throw Error(`Interview ${key} must be under ${max} characters.`);result[key]=text.trim();}
 if(result.type&&!meetingTypes.includes(result.type))throw Error('Choose an interview type.');
 return result;
}
