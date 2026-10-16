import {CoreError,exact,uuid} from './core.js'
export type NotepadObservation={instanceId:string;observationId:string;monotonicMs:number;geometry:string;pid:number;windowId:string;foreground:boolean;text:string;source:'owned-notepad-editor'}
export type NotepadJob={version:1;taskId:string;operationId:string;state:'waiting-permission'|'queued'|'running'|'succeeded'|'failed'|'cancelled'|'stop-unverified';text:string;reason?:string;result?:{source:'native-notepad';verified:true;text:string};events:{state:NotepadJob['state'];elapsedMs:number}[]}
export function validNotepadText(v:unknown):v is string{return typeof v==='string'&&v.length>0&&v.length<=200&&Array.from(v).every(c=>{const n=c.charCodeAt(0);return (n>=32||n===10)&&!(n>=127&&n<160)&&!(n>=55296&&n<=57343)})}
export function parseNotepadPlan(v:unknown){
 if(!exact(v,['version','operationId','instruction'])||v.version!==1||!uuid(v.operationId)||typeof v.instruction!=='string'||v.instruction.length>220)throw new CoreError('invalid')
 const m=/^(?:พิมพ์(?:ข้อความ)?|type)\s+([\s\S]+)$/i.exec(v.instruction.trim());if(!m||!validNotepadText(m[1]))throw new CoreError('unsupported-instruction')
 return{operationId:v.operationId,text:m[1]}
}
export function parseNotepadObservation(v:unknown):NotepadObservation{
 if(!exact(v,['instanceId','observationId','monotonicMs','geometry','pid','windowId','foreground','text','source'])||!uuid(v.instanceId)||!uuid(v.observationId)||typeof v.monotonicMs!=='number'||!Number.isFinite(v.monotonicMs)||v.monotonicMs<0||typeof v.geometry!=='string'||v.geometry.length>1000||!Number.isInteger(v.pid)||Number(v.pid)<=0||typeof v.windowId!=='string'||!/^\d+$/.test(v.windowId)||typeof v.foreground!=='boolean'||typeof v.text!=='string'||v.text.length>800||v.source!=='owned-notepad-editor')throw new CoreError('protocol')
 return v as NotepadObservation
}
export function parseNotepadJob(v:unknown):NotepadJob{
 if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['version','taskId','operationId','state','text','reason','result','events'].includes(k)))throw new CoreError('protocol');const j=v as NotepadJob
 if(j.version!==1||!uuid(j.taskId)||!uuid(j.operationId)||!validNotepadText(j.text)||!['waiting-permission','queued','running','succeeded','failed','cancelled','stop-unverified'].includes(j.state)||!Array.isArray(j.events)||j.events.length>12||j.events.some(e=>!exact(e,['state','elapsedMs'])||!['waiting-permission','queued','running','succeeded','failed','cancelled','stop-unverified'].includes(String(e.state))||typeof e.elapsedMs!=='number'||!Number.isFinite(e.elapsedMs)||e.elapsedMs<0)||j.reason!==undefined&&(typeof j.reason!=='string'||j.reason.length>100))throw new CoreError('protocol')
 if(j.state==='succeeded'&&!j.result||j.result&&(j.state!=='succeeded'||!exact(j.result,['source','verified','text'])||j.result.source!=='native-notepad'||j.result.verified!==true||typeof j.result.text!=='string'||j.result.text.length>800))throw new CoreError('protocol');return j
}
