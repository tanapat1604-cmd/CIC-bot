import {createHash} from 'node:crypto'
import {parseAssistantDecision,type AssistantInput,type AssistantDecision} from '../shared/assistant.js'
export const assistantFollowup=(v:AssistantInput)=>!!v.question||/^(?:แล้ว|ต่อ|จากเมื่อกี้|อันนั้น|แบบนั้น|ที่พูด|ใช่|ไม่ใช่)/u.test(v.text)||/^(?:ช่วย\s*)?(?:ทำ|จัด|เตรียม)?(?:อันนั้น|อันนี้|แบบนั้น|แบบเดิม)/u.test(v.text)
// Remember only a tool selection in RAM, never a result, permission or model answer.
export function createAssistantToolMemory(now=()=>Date.now()){
 const rows=new Map<string,{decision:AssistantDecision;expires:number}>()
 const key=(input:AssistantInput,namespace:string)=>createHash('sha256').update(namespace+'\n'+input.text.normalize('NFC').trim()).digest('hex')
 return{
  get(input:AssistantInput,namespace:string){if(assistantFollowup(input))return null;const id=key(input,namespace),row=rows.get(id);if(!row)return null;if(row.expires<=now()){rows.delete(id);return null}return structuredClone(row.decision)},
  put(input:AssistantInput,namespace:string,value:AssistantDecision){const decision=parseAssistantDecision(value);if(assistantFollowup(input)||!['calculator','time-calculator','clock'].includes(decision.tool))return false;for(const[id,row]of rows)if(row.expires<=now())rows.delete(id);if(rows.size>=32)rows.delete(rows.keys().next().value!);rows.set(key(input,namespace),{decision:structuredClone(decision),expires:now()+300000});return true},
 }
}
