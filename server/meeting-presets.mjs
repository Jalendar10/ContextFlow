import {randomUUID} from 'node:crypto';
import {meetingDetails} from '../meeting-details.js';
import {meetingContext} from './meeting-context.mjs';
export class MeetingPresets{
 constructor(storage){this.storage=storage;}
 list(){return Object.values(this.storage.read('meeting-presets.json'));}
 save(body){
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100)throw Error('Enter a setup name under 100 characters.');
  const settings=body.settings;if(!settings||!['tab','app','microphone','system'].includes(settings.kind))throw Error('Choose an audio source.');
  if(!['meeting','interview'].includes(settings.responseStyle)||!['meeting','microphone','all'].includes(settings.detectionTrack))throw Error('Choose valid answer settings.');
  for(const key of ['microphone','autoAnswer'])if(typeof settings[key]!=='boolean')throw Error('Invalid audio or answer setting.');
  for(const key of ['agentId','appBundleId'])if(settings[key]!==undefined&&(typeof settings[key]!=='string'||settings[key].length>200))throw Error('Invalid agent or app.');
  const records=this.storage.read('meeting-presets.json');if(body.id&&!records[body.id])throw Error('Saved setup not found.');if(!body.id&&Object.keys(records).length>=50)throw Error('Save up to 50 meeting setups.');
  const preset={id:body.id||randomUUID(),name:body.name.trim(),settings:{kind:settings.kind,appBundleId:settings.appBundleId||'',microphone:settings.microphone,autoAnswer:settings.autoAnswer,agentId:settings.agentId||'',responseStyle:settings.responseStyle,detectionTrack:settings.detectionTrack,details:{type:meetingDetails(settings.details).type},context:meetingContext(settings.context)},updatedAt:new Date().toISOString()};
  records[preset.id]=preset;this.storage.write('meeting-presets.json',records);return preset;
 }
 remove(id){const records=this.storage.read('meeting-presets.json');if(!records[id])throw Error('Saved setup not found.');delete records[id];this.storage.write('meeting-presets.json',records);}
}
