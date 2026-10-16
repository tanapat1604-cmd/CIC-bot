import {explicitChromeQuery} from '../../shared/chromeQuery'
import {parseAssistantDecision,assistantAppTarget,type AssistantInput} from '../../shared/assistant'
import type {ToolChoice,ToolQuestion} from './toolChoice'
export function needsAssistant(text:string,choice:ToolChoice,pending:ToolQuestion|null,now=Date.now()){return choice.kind==='research'&&!explicitChromeQuery(text)&&!/^(?:(?:ช่วย|กรุณา|please)\s*)?(?:ค้นหา|ค้นเว็บ|ค้น|search|หา(?:ข้อมูล|ข่าว|เรื่อง))/iu.test(text)&&!(pending?.slot==='query'&&pending.expiresAt>now)}
export async function thinkChoice(base:string,input:AssistantInput,signal:AbortSignal):Promise<{choice:ToolChoice;model:string;elapsedMs:number;cacheHit:boolean}>{
 const r=await fetch(base+'/assistant/think',{method:'POST',credentials:'include',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.any([signal,AbortSignal.timeout(25000)])})
 const v=await r.json();signal.throwIfAborted();if(!r.ok)throw Error(v.code??'assistant-unavailable')
 if(v.version!==1||v.operationId!==input.operationId||v.source!=='local-ai-proposal'||typeof v.model!=='string'||!Number.isFinite(v.elapsedMs)||v.elapsedMs<0)throw Error('protocol')
 const d=parseAssistantDecision(v.decision);let choice:ToolChoice
 if(d.tool==='answer')choice={kind:'answer',message:d.argument}
 else if(d.tool==='ask')choice={kind:'clarify',pending:{slot:'task',expiresAt:Date.now()+60000,question:d.argument}}
 else if(d.tool==='app')choice=assistantAppTarget(input.text)===d.argument?{kind:'app',instruction:'เปิด '+(d.argument==='notepad'?'Notepad':d.argument==='chrome'?'Chrome':'YouTube')}:{kind:'clarify',pending:{slot:'app',expiresAt:Date.now()+60000,question:'ต้องการเปิดโปรแกรมไหนครับ: Chrome, YouTube หรือ Notepad?'}}
 else if(d.tool==='research')choice={kind:'research',instruction:'ค้นหา '+d.argument}
 else choice={kind:'utility',plan:{kind:d.tool,instruction:d.tool==='calculator'?'/calc '+d.argument:d.tool==='time-calculator'?'/time '+d.argument:input.text}}
 return{choice,model:v.model,elapsedMs:v.elapsedMs,cacheHit:v.cacheHit===true}
}
