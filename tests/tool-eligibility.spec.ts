import {test,expect} from '@playwright/test'
import {assistantToolsFor} from '../backend/assistantTools'
import {groundAssistantDecision} from '../backend/assistant'
const input=(text:string)=>({version:1 as const,operationId:crypto.randomUUID(),text,history:[],question:null})
test('advice with a time budget never enables numeric/time tools and rejects a hallucinated time proposal',()=>{
 for(const text of ['ช่วยบอกวิธีจัดงานที่ค้างให้ทำง่ายขึ้น','อ่านหนังสือสอบ มีเวลา2ชั่วโมง','How can I tidy my desk in 20 minutes?']){
  const i=input(text);expect(assistantToolsFor(i)).toEqual(['answer','ask']);expect(()=>groundAssistantDecision(i,{tool:'time-calculator',argument:'10:00 + 20'})).toThrow('tool-outside-request')
 }
})
test('new topic ignores arithmetic history, while an actual answered math question retains its operands',()=>{
 const i={...input('ช่วยวางแผนเริ่มทำรายงาน'),history:[{role:'user' as const,text:'มีของ73ชิ้นแจก26ชิ้นเหลือเท่าไร'},{role:'assistant' as const,text:'73-26=47'}]};expect(assistantToolsFor(i)).toEqual(['answer','ask'])
 expect(assistantToolsFor({...input('73-26'),question:'ต้องการคำนวณสมการอะไร?'})).toContain('calculator')
 expect(assistantToolsFor(input('I had 73 stamps and gave 26 away. How many are left?'))).toContain('calculator')
})
test('time arithmetic requires an actual clock anchor, and tool explanations retain prose-only scope',()=>{
 expect(assistantToolsFor(input('เวลา10:15 อีก25นาทีจะกี่โมง'))).toContain('time-calculator')
 for(const text of ['How do I open Chrome?','คุณอ่านภาพยังไง','อย่าเปิด Chrome'])expect(assistantToolsFor(input(text))).toEqual(['answer','ask'])
 expect(assistantToolsFor(input('Please open Chrome'))).toContain('app');expect(assistantToolsFor(input('Search for indoor plants'))).toContain('research')
})
