import {exact,uuid,CoreError} from './core.js'
export const LAB_ACTIONS=['click','type','slider','scroll'] as const
export type LabAction=typeof LAB_ACTIONS[number]
export type LabPlan={version:1;operationId:string;action:LabAction;text:string}
export type LabState='waiting-permission'|'queued'|'running'|'succeeded'|'failed'|'cancelled'|'stop-unverified'
export type LabJob={version:1;taskId:string;operationId:string;action:LabAction;text:string;state:LabState;reason?:string;result?:{source:'native-uia-lab';verified:true;text:string};events:{state:LabState;elapsedMs:number}[]}
export type LabObservation={instanceId:string;observationId:string;monotonicMs:number;geometry:string;foreground:boolean;clicks:number;text:string;slider:number;top:number;dpi:number;source:'owned-window-structure';availableActions:LabAction[];targets:{id:string;name:string;x:number;y:number;width:number;height:number}[]}
export function parseLabPlan(v:unknown):LabPlan{
 if(!exact(v,['version','operationId','action','text'])||v.version!==1||!uuid(v.operationId)||!LAB_ACTIONS.includes(v.action as LabAction)||typeof v.text!=='string'||v.text.length>40||Array.from(v.text).some(c=>c.charCodeAt(0)<32||(c.charCodeAt(0)>=127&&c.charCodeAt(0)<160))||v.action!=='type'&&v.text!==''||v.action==='type'&&!v.text.trim())throw new CoreError('invalid')
 return v as LabPlan
}
export function parseLabJob(v:unknown):LabJob{
 if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['version','taskId','operationId','action','text','state','reason','result','events'].includes(k)))throw new CoreError('protocol');const j=v as LabJob
 if(j.version!==1||!uuid(j.taskId)||!uuid(j.operationId)||!LAB_ACTIONS.includes(j.action)||!['waiting-permission','queued','running','succeeded','failed','cancelled','stop-unverified'].includes(j.state)||typeof j.text!=='string'||j.text.length>40||!Array.isArray(j.events)||j.events.length>12||j.events.some(e=>!Number.isFinite(e.elapsedMs)||e.elapsedMs<0)||j.state==='succeeded'&&(!j.result||j.result.source!=='native-uia-lab'||j.result.verified!==true||typeof j.result.text!=='string'))throw new CoreError('protocol')
 if(j.reason!==undefined&&(typeof j.reason!=='string'||j.reason.length>100)||j.result&&(j.state!=='succeeded'||!exact(j.result,['source','verified','text'])||j.result.source!=='native-uia-lab'||j.result.verified!==true||typeof j.result.text!=='string'||j.result.text.length>512))throw new CoreError('protocol')
 return j
}
export function parseLabObservation(v:unknown):LabObservation{
 if(!exact(v,['instanceId','observationId','monotonicMs','geometry','foreground','clicks','text','slider','top','dpi','source','availableActions','targets'])||!uuid(v.instanceId)||!uuid(v.observationId)||!Number.isFinite(v.monotonicMs)||Number(v.monotonicMs)<0||typeof v.geometry!=='string'||v.geometry.length>1500||typeof v.foreground!=='boolean'||!Number.isInteger(v.clicks)||typeof v.text!=='string'||v.text.length>40||!Number.isFinite(v.slider)||!Number.isInteger(v.top)||!Number.isFinite(v.dpi)||v.source!=='owned-window-structure'||!Array.isArray(v.availableActions)||v.availableActions.length>4||new Set(v.availableActions).size!==v.availableActions.length||v.availableActions.some(a=>!LAB_ACTIONS.includes(a))||!Array.isArray(v.targets)||v.targets.length!==4)throw new CoreError('protocol')
 for(const[t,i]of v.targets.map((t,i)=>[t,i] as const))if(!exact(t,['id','name','x','y','width','height'])||t.id!==LAB_ACTIONS[i]||t.name!==t.id||![t.x,t.y,t.width,t.height].every(Number.isFinite)||Number(t.width)<=0||Number(t.height)<=0)throw new CoreError('protocol')
 return v as LabObservation
}
