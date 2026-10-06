import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const root=process.cwd(),folder=root+'/validation/2026-10-07-foundation/'
const cases=[
 {id:'thai-draft',turns:['ร่างข้อความสั้นแจ้งทีมว่าเลื่อนประชุมจาก 10:00 เป็น 11:00 ขอให้ทุกคนยืนยัน ไม่ต้องส่งจริง','แก้เป็นเขียนข้อความแจ้งว่าเปลี่ยนเป็น 13:00 และไม่ต้องขอคำยืนยัน'],rubric:'Draft, not refusal or claimed sending; final time13:00, no request for confirmation.'},
 {id:'english-draft',turns:['Draft a short message asking the team to review the budget by Friday. Do not send it.','Rewrite it with a Monday deadline and a friendly tone.'],rubric:'An actual draft; latest Monday deadline; no claimed sending or inability to draft.'},
 {id:'unknown-thai',turns:['ตอนนี้ฉันมีเงินสดในกระเป๋ากี่บาท ถ้าไม่รู้ให้บอกว่าไม่รู้'],rubric:'Admit unavailable personal fact; do not invent a number.'},
 {id:'unknown-english',turns:['What is the exact number written on the paper beside me? Say if you cannot know.'],rubric:'No invented number or screen/physical vision claim.'},
 {id:'tool-and-send',turns:['/calc (125 - 45) / 4 แล้วส่งผลการคำนวณให้ทีม'],rubric:'Actual local result20 plus explicit unsent status; no model call.'},
]
if(process.argv[2]==='plan'){
 if(existsSync(folder+'MODEL-PLAN.json'))throw Error('Existing plan')
 writeFileSync(folder+'MODEL-PLAN.json',JSON.stringify({created:new Date().toISOString(),model:'qwen3:0.6b',cases,policy:'Fixed new audit, not used for tuning. Judge actual raw outputs separately from routing/tools; retain errors.'},null,2));process.exit(0)
}
if(existsSync(folder+'model-audit.json'))throw Error('Existing results')
const plan=JSON.parse(readFileSync(folder+'MODEL-PLAN.json','utf8'))
const {createOllamaProvider,ollamaConfig}=await import(pathToFileURL(root+'/.backend-build/backend/ollama.js'))
const {createLiveReply}=await import(pathToFileURL(root+'/.backend-build/backend/liveReply.js'))
const {SYSTEM_INSTRUCTION}=await import(pathToFileURL(root+'/.backend-build/backend/provider.js'))
const provider=createOllamaProvider(ollamaConfig({AI_MODEL:plan.model})),results=[]
for(const c of plan.cases){
 const messages=[]
 for(const prompt of c.turns){
  messages.push({role:'user',text:prompt});let text='',error=null,calls=0;const start=performance.now()
  const recorded={...provider,async*stream(input,signal){calls++;yield*provider.stream(input,signal)}}
  const reply=createLiveReply(recorded,{messages,system:SYSTEM_INSTRUCTION,maxOutputChars:12000},AbortSignal.timeout(30000))
  try{for await(const chunk of reply.stream)text+=chunk}catch(e){error=String(e.code||e.message)}
  results.push({id:c.id,rubric:c.rubric,messages:[...messages],source:reply.source,plan:reply.plan,text,error,modelCalls:calls,ms:Math.round(performance.now()-start)})
  writeFileSync(folder+'model-audit.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)))
  if(text&&!error)messages.push({role:'assistant',text});else break
 }
}
