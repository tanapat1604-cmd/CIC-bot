import {CoreError,type CoreTool} from '../../shared/core.js'
import {calculate,addMinutes} from '../textUtilities.js'
import {parseTextTool,runTextTool} from '../toolRunner.js'
export type RegisteredTool={id:CoreTool;agentId:'UtilityAgent';permission:'tools.calculate';cost:0;reserveMiB:8;native:false;execute:(expression:string,signal:AbortSignal)=>Promise<unknown>;verify:(expression:string,result:unknown)=>string}
export function registry():readonly RegisteredTool[]{return (['calculator','time-calculator'] as const).map(id=>({
 id,agentId:'UtilityAgent',permission:'tools.calculate',cost:0,reserveMiB:8,native:false,
 execute:(expression,signal)=>runTextTool({tool:id,input:{expression}},signal),
 verify(expression,result){
  const r=result as {tool?:unknown;source?:unknown;status?:unknown;text?:unknown}|null;
  if(!r||r.tool!==id||r.source!==id||r.status!=='complete'||typeof r.text!=='string')throw new CoreError('tool-failed')
  const expected=expression+' = '+(id==='calculator'?calculate(expression):addMinutes(expression))+(id==='time-calculator'?'\nคำนวณเวลาเท่านั้น ไม่ได้ตั้งเตือนหรือนัดหมาย':'')
  if(r.text!==expected)throw new CoreError('verification-failed');return r.text
 }
}))}
export function boundedPlan(instruction:string){
 const call=parseTextTool(instruction);if(!call||!call.input.expression||call.input.expression.length>128)throw new CoreError('unsupported')
 if(call.tool==='calculator'?/[^\d\s.+\-*/()]/u.test(call.input.expression):!/^[\d\s:+-]+$/.test(call.input.expression))throw new CoreError('invalid')
 return {toolId:call.tool,args:Object.freeze({expression:call.input.expression})}
}
export const AGENT_CONTRACTS=Object.freeze([
 {id:'UtilityAgent',supported:['/calc','/time'],enabled:true,permission:'tools.calculate',observation:'typed-user-instruction',execute:'registered-local-tool',verify:'exact-tool-output',cancel:'abort-and-await-settlement',cleanup:'memory-expiry'},
 ...['VoiceAgent','ScreenObserver','DesktopAgent','BrowserAgent','ResearchAgent','GameAgent','SlidesAgent','CodingAgent'].map(id=>({id,supported:[],enabled:false,permission:'separate-scoped-grant-required',observation:'fresh-structured-source-required',execute:'no-core-adapter',verify:'required-before-enabled',cancel:'unimplemented-native-contract',cleanup:'required-before-enabled'})),
])
