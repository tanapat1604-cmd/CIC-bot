import fs from 'node:fs/promises'
import {test,expect} from '@playwright/test'
import {chooseTypedTool,type ToolQuestion} from '../src/voice/toolChoice'
import {needsAssistant} from '../src/voice/assistantChoice'
import {calculate} from '../backend/textUtilities'
const group=process.env.CIC_MATH_HELD==='1'?'held':'development',label=process.env.CIC_MATH_LABEL??group
const dev=[['สิบหกบวกเก้า','16 + 9','25'],['คำนวณยี่สิบเอ็ดคูณสอง','21 * 2','42'],['calculate sixteen plus nine','16 + 9','25'],['ติดลบห้าบวกเจ็ด','-5 + 7','2'],['สองจุดห้าหารสอง','2.5 / 2','1.25']] as const
const held=[['เก้าสิบเก้าลบสี่สิบเจ็ด','99 - 47','52'],['two hundred thirty six divided by four','236 / 4','59'],['negative eight times three','-8 * 3','-24'],['seven point two five minus two point five','7.25 - 2.5','4.75']] as const
test(group+': exact spoken math calculates original operands without AI',async()=>{
 const rows=[];for(const [text,expression,answer]of group==='held'?held:dev){const began=performance.now(),choice=chooseTypedTool(text,null,1000),actual=choice.kind==='utility'&&choice.plan.kind==='calculator'?choice.plan.instruction:null;rows.push({text,expression,answer,actual,computed:actual?calculate(actual.slice(6)):null,choice,elapsedMs:performance.now()-began,modelNeeded:needsAssistant(text,choice,null,1000)})}
 await fs.writeFile('validation/2026-10-14-spoken-math/'+label+'-EXACT.json',JSON.stringify(rows,null,2),{flag:'wx'});for(const row of rows){expect(row.actual,row.text).toBe('/calc '+row.expression);expect(row.computed).toBe(row.answer);expect(row.modelNeeded).toBe(false)}
})
test(group+': missing part asks only what is missing, expires and preserves payload',async()=>{
 const text=group==='held'?'คำนวณสิบเอ็ดบวก':'sixteen plus',payload=group==='held'?'ยี่สิบเอ็ด':'nine',expected=group==='held'?'/calc 11 + 21':'/calc 16 + 9';const first=chooseTypedTool(text,null,1000),pending=first.kind==='clarify'?first.pending:null,next=chooseTypedTool(payload,pending,2000),expired=chooseTypedTool(payload,pending,62000)
 await fs.writeFile('validation/2026-10-14-spoken-math/'+label+'-MISSING.json',JSON.stringify({text,payload,expected,first,next,expired},null,2),{flag:'wx'});expect(first.kind).toBe('clarify');expect(pending?.arithmetic?.operator).toBe('+');expect(needsAssistant(text,first,null,1000)).toBe(false);expect(next).toMatchObject({kind:'utility',plan:{kind:'calculator',instruction:expected}});expect(expired.kind).not.toBe('utility')
})
test(group+': unknown, advice, negation and ambiguous grouping do not become commands',async()=>{
 const corpus=group==='held'?['ร้อยห้าบวกสอง','how does sixteen plus nine work?','twenty oh five plus three','open Chrome then sixteen plus nine']:['อย่าคำนวณสิบหกบวกเก้า','หยุ่น','ช่วยอธิบายสิบหกบวกเก้า','สองบวกสามคูณสี่','สิบหกบวกเก้าแล้วเปิดโครม'];const rows=corpus.map(text=>({text,choice:chooseTypedTool(text,null,1000)}));await fs.writeFile('validation/2026-10-14-spoken-math/'+label+'-NONEXECUTION.json',JSON.stringify(rows,null,2),{flag:'wx'});for(const {text,choice}of rows)expect(choice.kind==='utility'&&choice.plan.kind==='calculator',text).toBe(false);if(group==='development')expect(rows.find(r=>r.text==='สองบวกสามคูณสี่')?.choice.kind).toBe('clarify')
})
test('existing query/notepad payload precedence still wins and leading missing operand is retained',()=>{
 for(const slot of ['query','notepad-text']as const){const pending:ToolQuestion={slot,question:'payload',expiresAt:2000};const choice=chooseTypedTool('สิบหกบวกเก้า',pending,1000);expect(choice.kind).toBe(slot==='query'?'research':'notepad')}
 if(group==='development'){const first=chooseTypedTool('หารสอง',null,1000);expect(first.kind).toBe('clarify');const second=chooseTypedTool('แปด',first.kind==='clarify'?first.pending:null,1100);expect(second).toMatchObject({kind:'utility',plan:{instruction:'/calc 8 / 2'}})}
})
