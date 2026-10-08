import {record} from './chatProtocol.js'
export const CORE_VERSION=1 as const
export const CORE_STATES=['idle','planned','waiting-permission','queued','running','verifying','succeeded','failed','cancelling','cancelled','stop-unverified'] as const
export type CoreState=typeof CORE_STATES[number]
export type CoreTool='calculator'|'time-calculator'
export type CorePermission='tools.calculate'|'screen.read'|'mic.listen'|'audio.speak'|'desktop.control'|'browser.read'|'browser.control'|'web.fetch'|'workspace.read'|'workspace.write'|'process.run'|'external-provider.egress'
export type CorePlanInput={version:1;operationId:string;instruction:string}
export type CoreEvent={sequence:number;state:CoreState;elapsedMs:number;reason?:string}
export type CoreJob={version:1;taskId:string;operationId:string;state:CoreState;toolId:CoreTool;agentId:'UtilityAgent';args:{expression:string};events:CoreEvent[];result?:{text:string;source:CoreTool;evidence:'NATIVE-TOOL';verified:true};reason?:string}
export const CAPABILITY_KEYS=['readOnlyCapture','reviewedOCR','structuredObservation','desktopControl','voiceInput','thaiSpeechOutput','webResearch','workspaceEdit','animatedSlides'] as const
export type CapabilityKey=typeof CAPABILITY_KEYS[number]
export type RuntimeCapability={id:CapabilityKey;implemented:boolean;configured:boolean|null;authorized:boolean;healthy:boolean|null;accepted:boolean;mode:'manual'|'disabled';evidence:'USER-REPORTED'|'NATIVE-TOOL'|'NOT-RUN';detail:string}
export type CoreCapabilities={version:1;policyVersion:1;mode:'local';capabilities:RuntimeCapability[];core:{implemented:true;scope:'calculator-time-only';nativeControl:false;queueLimit:2;heavyLimit:1;headroomMiB:512;reserveMiB:8}}
export class CoreError extends Error{constructor(readonly code:string){super(code)}}
export function uuid(value:unknown):value is string{return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)}
export function exact(value:unknown,keys:string[]):value is Record<string,unknown>{return record(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k))}
export function parseCorePlan(value:unknown):CorePlanInput{
 if(!exact(value,['version','operationId','instruction'])||value.version!==1||!uuid(value.operationId)||typeof value.instruction!=='string'||!value.instruction.trim()||value.instruction.length>160)throw new CoreError('invalid')
 return {version:1,operationId:value.operationId,instruction:value.instruction}
}
export function parseCoreJob(value:unknown):CoreJob{
 if(!record(value)||Object.keys(value).some(k=>!['version','taskId','operationId','state','toolId','agentId','args','events','result','reason'].includes(k))||value.version!==1||!uuid(value.taskId)||!uuid(value.operationId)||!CORE_STATES.includes(value.state as CoreState)||!['calculator','time-calculator'].includes(String(value.toolId))||value.agentId!=='UtilityAgent'||!exact(value.args,['expression'])||typeof value.args.expression!=='string'||value.args.expression.length>128||!Array.isArray(value.events)||value.events.length>24)throw new CoreError('protocol')
 for(const e of value.events)if(!record(e)||!Number.isInteger(e.sequence)||!CORE_STATES.includes(e.state as CoreState)||typeof e.elapsedMs!=='number'||!Number.isFinite(e.elapsedMs)||e.elapsedMs<0)throw new CoreError('protocol')
 if(value.state==='succeeded'&&!value.result)throw new CoreError('protocol')
 if(value.reason!==undefined&&(typeof value.reason!=='string'||value.reason.length>100))throw new CoreError('protocol')
 if(value.result&&(!exact(value.result,['text','source','evidence','verified'])||typeof value.result.text!=='string'||value.result.text.length>4096||value.result.source!==value.toolId||value.result.evidence!=='NATIVE-TOOL'||value.result.verified!==true||value.state!=='succeeded'))throw new CoreError('protocol')
 return value as CoreJob
}
export function parseCoreCapabilities(value:unknown):CoreCapabilities{
 if(!record(value)||value.version!==1||value.policyVersion!==1||value.mode!=='local'||!Array.isArray(value.capabilities)||value.capabilities.length!==CAPABILITY_KEYS.length||!record(value.core)||value.core.implemented!==true||value.core.scope!=='calculator-time-only'||value.core.nativeControl!==false||value.core.queueLimit!==2||value.core.heavyLimit!==1||value.core.headroomMiB!==512||value.core.reserveMiB!==8)throw new CoreError('protocol')
 for(const[id,i]of CAPABILITY_KEYS.map((id,i)=>[id,i] as const)){const c=value.capabilities[i];if(!exact(c,['id','implemented','configured','authorized','healthy','accepted','mode','evidence','detail'])||c.id!==id||typeof c.implemented!=='boolean'||!(c.configured===null||typeof c.configured==='boolean')||typeof c.authorized!=='boolean'||!(c.healthy===null||typeof c.healthy==='boolean')||typeof c.accepted!=='boolean'||!['manual','disabled'].includes(String(c.mode))||!['USER-REPORTED','NATIVE-TOOL','NOT-RUN'].includes(String(c.evidence))||typeof c.detail!=='string'||c.detail.length>1000)throw new CoreError('protocol')}
 return value as CoreCapabilities
}
