import {CoreError,exact,uuid} from './core.js'
export type AssistantDecision={tool:'answer'|'ask'|'calculator'|'clock'|'time-calculator'|'screen'|'ocr'|'slides'|'research'|'app';argument:string}
export type AssistantInput={version:1;operationId:string;text:string;history:{role:'user'|'assistant';text:string}[];question:string|null}
const clean=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&![...v].some(c=>c.charCodeAt(0)<32)
export function parseAssistantInput(v:unknown):AssistantInput{
 if(!exact(v,['version','operationId','text','history','question'])||v.version!==1||!uuid(v.operationId)||!clean(v.text,200)||v.question!==null&&!clean(v.question,300)||!Array.isArray(v.history)||v.history.length>4)throw new CoreError('invalid')
 for(const m of v.history)if(!exact(m,['role','text'])||!['user','assistant'].includes(String(m.role))||!clean(m.text,600))throw new CoreError('invalid')
 return v as unknown as AssistantInput
}
export function parseAssistantDecision(v:unknown):AssistantDecision{
 if(!exact(v,['tool','argument'])||!['answer','ask','calculator','clock','time-calculator','screen','ocr','slides','research','app'].includes(String(v.tool))||typeof v.argument!=='string'||v.argument.length>600||[...v.argument].some(c=>c.charCodeAt(0)<32))throw new CoreError('invalid-model-plan')
 const d=v as unknown as AssistantDecision
 if(['answer','ask','research'].includes(d.tool)&&!d.argument.trim())throw new CoreError('invalid-model-plan')
 if(d.tool==='calculator'&&(d.argument.length>128||!/[0-9]/u.test(d.argument)||!/^[\d\s.+\-*/()]+$/u.test(d.argument)))throw new CoreError('invalid-model-plan')
 if(d.tool==='time-calculator'&&!/^\d{2}:\d{2}(?:\s*[+-]\s*\d{1,5})+$/u.test(d.argument))throw new CoreError('invalid-model-plan')
 if(d.tool==='app'&&!['notepad','chrome','youtube'].includes(d.argument))throw new CoreError('invalid-model-plan')
 if(['clock','screen','ocr','slides'].includes(d.tool)&&d.argument!=='')throw new CoreError('invalid-model-plan')
 if(d.tool==='research'&&(d.argument.length>160||/[;&|`<>]|https?:|www\.|[\\/]/iu.test(d.argument)))throw new CoreError('invalid-model-plan')
 return d
}

// A named target is data for a proposal, never launch permission. Ambiguity is
// resolved by the user; a model cannot substitute a different supported app.
export function assistantAppTarget(text:string):'chrome'|'notepad'|'youtube'|null{
 const targets=([['chrome',/(?:โครม|โครเมียม|\bchrome\b)/iu],['notepad',/(?:โน้ตแพด|สมุดบันทึก|\bnotepad\b)/iu],['youtube',/(?:ยูทูบ|\byoutube\b)/iu]] as const).filter(([,pattern])=>pattern.test(text.normalize('NFC')))
 return targets.length===1?targets[0][0]:null
}
