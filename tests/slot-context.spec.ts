import fs from 'node:fs/promises'
import {test,expect} from '@playwright/test'
import {chooseTypedTool,type ToolQuestion} from '../src/voice/toolChoice'
import {needsAssistant} from '../src/voice/assistantChoice'
test('frozen '+(process.env.CIC_SLOT_HOLDOUT==='1'?'holdout':'development')+' slot context',async()=>{
 const dir='validation/2026-10-13-slot-context',corpus=JSON.parse(await fs.readFile(dir+'/CORPUS.json','utf8'))
 const group=process.env.CIC_SLOT_HOLDOUT==='1'?'holdout':'dev',rows=[]
 for(const row of corpus[group]){
  const pending:ToolQuestion={slot:row.slot,question:row.slot==='query'?'ค้นหาเรื่องอะไรครับ?':'ต้องการพิมพ์ข้อความอะไรครับ?',expiresAt:row.expired?999:2000},began=performance.now()
  const choice=chooseTypedTool(row.text,pending,1000),elapsedMs=performance.now()-began,modelNeeded=needsAssistant(row.text,choice,pending,1000)
  const actualInstruction='instruction'in choice?choice.instruction:choice.kind==='utility'?choice.plan.instruction:undefined
  const ok=choice.kind===row.kind&&(!row.instruction||actualInstruction===row.instruction)&&!modelNeeded
  rows.push({id:row.id,text:row.text,expected:row,choice,elapsedMs,modelNeeded,ok})
 }
 await fs.writeFile(dir+'/'+(process.env.CIC_SLOT_LABEL??group)+'-CASES.json',JSON.stringify({group,rows,passed:rows.filter(r=>r.ok).length,total:rows.length},null,2),{flag:'wx'})
 expect(rows.filter(r=>!r.ok),'all original expectations retained').toEqual([])
})
