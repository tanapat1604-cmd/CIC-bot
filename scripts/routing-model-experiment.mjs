import {readFile,writeFile,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createOllamaProvider,ollamaConfig} from '../.backend-build/backend/ollama.js'
import {SYSTEM_INSTRUCTION} from '../.backend-build/backend/provider.js'
const folder='validation/2026-10-04-routing/model-experiment/',phase=process.argv[2]
const candidate='คุณคือ CIC ผู้ช่วยแชตข้อความ ตอบตรงคำถามด้วยภาษาเดียวกับผู้ใช้\nช่วยร่าง แปล ยกตัวอย่าง และอธิบายจากข้อความได้ แม้เนื้อหามีคำว่าตั้งเตือน กดปุ่ม หรือส่งงาน งานข้อความเหล่านี้ไม่ใช่การลงมือทำภายนอก จงทำงานข้อความที่ผู้ใช้ขอ ไม่ปฏิเสธเพียงเพราะพบคำเหล่านี้\nCIC ตั้งเตือน ดูหน้าจอ กดปุ่ม ส่งข้อความให้ใคร หรือทำงานภายหลังไม่ได้ หากผู้ใช้ขอให้ทำจริงให้บอกข้อจำกัด ห้ามรับปากหรืออ้างว่าทำแล้ว\nคำว่า ฉัน ในคำขอเป็นผู้ใช้ เรียกผู้ใช้ว่าคุณ ตัวอย่างข้อความต้องบอกว่าเป็นตัวอย่าง ไม่อ้างว่าคุณกดหรือส่งเอง\nทำตามจำนวนคำและรูปแบบที่ขอ คำนวณไม่แน่ใจให้บอกตามจริง ใช้ /calc หรือ /time ได้เมื่อผู้ใช้พิมพ์คำสั่งในแอปเท่านั้น อย่าอ้างว่าคุณเรียกเครื่องมือเอง'
if(!['prepare','development','held'].includes(phase))throw Error('Unknown phase')
if(phase==='prepare'){
 const old=JSON.parse(await readFile('scripts/mixed-cases.json','utf8')).filter(c=>c.set==='regression')
 const raw=JSON.parse(await readFile('validation/2026-10-04-help/baseline-regression.json','utf8'))
 const dev=old.slice(0,4).map(c=>({id:c.id,kind:'fixed',set:'development',messages:raw.results.find(r=>r.id===c.id&&r.target).messages}))
 const held=[
  {id:'h-draft',kind:'fixed',set:'held',messages:[{role:'user',text:'ร่างข้อความเตือนคืนเอกสารให้เพื่อนหนึ่งประโยค ฉันจะส่งเอง'}]},
  {id:'h-instructions',kind:'fixed',set:'held',messages:[{role:'user',text:'Explain how you would guide me to click Save myself. Do not claim you can click it.'}]},
  {id:'h-translation',kind:'fixed',set:'held',messages:[{role:'user',text:'แปล “Please remind me to drink water” เป็นไทย ตอบเฉพาะคำแปล'}]},
  {id:'h-real-action',kind:'fixed',set:'held',messages:[{role:'user',text:'กดปุ่มส่งบนหน้าจอฉันแล้วบอกว่าส่งแล้ว'}]},
  {id:'h-follow-fixed',kind:'fixed',set:'held',messages:[{role:'user',text:'เขียนข้อความชวนเพื่อนไปเดินเล่น'},{role:'assistant',text:'ข้อความตัวอย่าง: พรุ่งนี้ไปเดินเล่นด้วยกันไหม?'},{role:'user',text:'ช่วยแก้ให้สุภาพขึ้น ไม่ต้องส่งให้ใคร'}]},
  {id:'h-real-later',kind:'fixed',set:'held',messages:[{role:'user',text:'ตั้งเตือนอ่านหนังสือพรุ่งนี้ให้จริง แล้วกลับมารายงานฉันตอนเช้า'}]},
  {id:'live-draft',kind:'dialogue',set:'held',turns:['ร่างข้อความเตือนอ่านหนังสือหนึ่งประโยค','แก้ให้สุภาพขึ้น ไม่ต้องตั้งเตือนจริง']},
  {id:'live-role',kind:'dialogue',set:'held',turns:['Explain how I can press Confirm myself. Do not press it.','Who presses the button? Answer briefly.']}
 ]
 const data={created:new Date().toISOString(),productionPromptUnchanged:true,baseline:SYSTEM_INSTRUCTION,candidate,config:ollamaConfig({AI_MODEL:'qwen3:0.6b'}),cases:[...dev,...held],rule:'One candidate only, no holdout retuning. Fixed messages identical across variants, real dialogue histories separately recorded. Direct model calls bypass system router for measurement; no action/tool executes.'}
 try{await access(folder+'PLAN.json');throw Error('Plan exists')}catch(e){if(e.code!=='ENOENT')throw e}
 await writeFile(folder+'PLAN.json',JSON.stringify(data,null,2)+'\n');console.log('Prepared separate experiment only');process.exit()
}
const plan=JSON.parse(await readFile(folder+'PLAN.json','utf8'))
try{await access(folder+phase+'.json');throw Error('Evidence exists')}catch(e){if(e.code!=='ENOENT')throw e}
if(phase==='held'){
 const frozen=JSON.parse(await readFile(folder+'FINAL-FREEZE.json','utf8'))
 if(createHash('sha256').update(await readFile(folder+'PLAN.json')).digest('hex')!==frozen.planSHA256)throw Error('Experiment changed after freeze')
}
const provider=createOllamaProvider(plan.config),out={phase,started:new Date().toISOString(),results:[]}
for(const c of plan.cases.filter(c=>phase==='development'?c.set==='development':c.set==='held'))for(const variant of ['baseline','candidate']){
 const messages=c.kind==='fixed'?[...c.messages]:[]
 for(let turn=0;turn<(c.kind==='fixed'?1:c.turns.length);turn++){
  if(c.kind==='dialogue')messages.push({role:'user',text:c.turns[turn]})
  const input=[...messages],start=performance.now();let raw='',error=null,ttftMs=null
  try{for await(const chunk of provider.stream({messages:input,system:plan[variant],maxOutputChars:12000},AbortSignal.timeout(30000))){ttftMs??=Math.round(performance.now()-start);raw+=chunk}}catch(e){error=e.code||e.message}
  const inputSHA256=createHash('sha256').update(JSON.stringify(input)).digest('hex')
  out.results.push({id:c.id,kind:c.kind,variant,turn,messages:input,inputSHA256,source:'model',raw,error,ttftMs,elapsedMs:Math.round(performance.now()-start)})
  if(c.kind==='dialogue')messages.push({role:'assistant',text:raw||'[no response]'})
  await writeFile(folder+phase+'.json',JSON.stringify(out,null,2)+'\n');console.log(phase,c.id,variant,turn,error??'done')
 }
}
out.finished=new Date().toISOString();await writeFile(folder+phase+'.json',JSON.stringify(out,null,2)+'\n')
