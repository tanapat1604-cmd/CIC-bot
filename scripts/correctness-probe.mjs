// Local opt-in evaluation; never downloads a model. Holdout outputs must not inform same-round edits.
import {readFile,writeFile,access} from 'node:fs/promises'
import {createOllamaProvider,ollamaConfig} from '../.backend-build/backend/ollama.js'
import {SYSTEM_INSTRUCTION} from '../.backend-build/backend/provider.js'
const phase=process.argv[2]
if(!['baseline-dev','capabilities-dev','roles-dev','concise-dev','system-dev','holdout'].includes(phase))throw new Error('Unknown phase')
const root='validation/2026-10-04-correctness/'
try {await access(root+phase+'.json');throw new Error('Evidence exists')}catch(e){if(e.code!=='ENOENT')throw e}
const old=JSON.parse(await readFile(root+'baseline-system.json','utf8'))
const cases=JSON.parse(await readFile('scripts/correctness-cases.json','utf8')).filter(c=>c.set===(phase==='holdout'?'holdout':'development'))
const config=ollamaConfig({AI_MODEL:'qwen3:0.6b'})
const provider=createOllamaProvider(config)
const data={phase,started:new Date().toISOString(),config,system:SYSTEM_INSTRUCTION,baselineSystem:old.system,version:await(await fetch('http://127.0.0.1:11434/api/version')).json(),results:[]}
let utility
if(phase==='system-dev'||phase==='holdout')({resolveTextUtility:utility}=await import('../.backend-build/backend/textUtilities.js'))
const save=()=>writeFile(root+phase+'.json',JSON.stringify(data,null,2))
for(const variant of phase==='holdout'?['baseline','final']:[phase]){
 for(const c of cases){
  const messages=[{role:'user',text:c.prompt}]
  const measure=async(messages,turn)=>{
   const start=performance.now();let text='',error=null,source='model',ttftMs=null
   try{
    const result=variant==='final'||phase==='system-dev'?utility(messages.at(-1).text):null
    if(result){text=result.text;source=result.source;ttftMs=0}
    else for await(const chunk of provider.stream({messages,system:variant==='baseline'||phase==='baseline-dev'?old.system:SYSTEM_INSTRUCTION,maxOutputChars:12000},AbortSignal.timeout(30000))){if(ttftMs===null)ttftMs=Math.round(performance.now()-start);text+=chunk}
   }catch(e){error=e.code||e.message}
   const item={variant,id:c.id,turn,prompt:c.prompt,followup:c.followup,messages,text,source,error,ttftMs,elapsedMs:Math.round(performance.now()-start),rubric:c.rubric};data.results.push(item);await save();console.log(JSON.stringify(item));return item
  }
  const first=await measure(messages,'initial')
  if(c.followup&&!first.error)await measure([...messages,{role:'assistant',text:first.text},{role:'user',text:c.followup}],'followup')
 }
}
data.finished=new Date().toISOString();await save()
