import {randomUUID} from 'node:crypto';
import {meetingContext} from './meeting-context.mjs';
export class AgentProfiles {
 constructor(ai){this.ai=ai;}
 list(){return Object.values(this.ai.config.read('agents.json'));}
 get(id){const agent=this.list().find(a=>a.id===id);if(!agent)throw Error('Agent not found.');return structuredClone(agent);}
 async save(body){if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100)throw Error('Enter an agent name under 100 characters.');if(typeof body.skills!=='string'||body.skills.length>16000)throw Error('Skills must be under 16,000 characters.');const context=meetingContext(body.context);if(!(await this.ai.catalog(body.provider)).answer.includes(body.model))throw Error('Choose an available agent answer model.');const agents=this.ai.config.read('agents.json');if(body.id&&!agents[body.id])throw Error('Agent not found.');if(!body.id&&Object.keys(agents).length>=50)throw Error('At most 50 agents can be saved.');const agent={id:body.id||randomUUID(),name:body.name.trim(),skills:body.skills,responseStyle:body.responseStyle==='interview'?'interview':'meeting',context,provider:body.provider,model:body.model,updatedAt:new Date().toISOString()};agents[agent.id]=agent;this.ai.config.write('agents.json',agents);return agent;}
 remove(id){const agents=this.ai.config.read('agents.json');if(!agents[id])throw Error('Agent not found.');delete agents[id];this.ai.config.write('agents.json',agents);}
}
