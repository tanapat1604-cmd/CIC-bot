import {readFile,writeFile,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createOllamaProvider,ollamaConfig} from '../.backend-build/backend/ollama.js'
import {SYSTEM_INSTRUCTION} from '../.backend-build/backend/provider.js'
import {validateRequest} from '../.backend-build/shared/chatProtocol.js'
const phase=process.argv[2],folder='validation/2026-10-04-routing/'
if(!['baseline-dev','baseline-holdout','final-dev','final-holdout'].includes(phase))throw Error('Unknown phase')
try{await access(folder+phase+'.json');throw Error('Evidence exists')}catch(e){if(e.code!=='ENOENT')throw e}
if(phase==='final-holdout'){
 const freeze=JSON.parse((await readFile(folder+'FINAL-FREEZE.json','utf8')).replace(/^\uFEFF/,''))
 for(const item of freeze.hashes)if(createHash('sha256').update(await readFile(item.file)).digest('hex').toUpperCase()!==item.sha256)throw Error('Changed after freeze: '+item.file)
}
const baseline=phase.startsWith('baseline'),held=phase.endsWith('holdout')
const live=await import(baseline?'../.tools/routing-baseline/backend/liveReply.js':'../.backend-build/backend/liveReply.js')
const cases=JSON.parse(await readFile('scripts/routing-cases.json','utf8')).filter(c=>held?c.set==='holdout':c.set!=='holdout')
const config=ollamaConfig({AI_MODEL:'qwen3:0.6b'}),provider=createOllamaProvider(config)
const data={phase,started:new Date().toISOString(),config,system:SYSTEM_INSTRUCTION,results:[]}
const save=()=>writeFile(folder+phase+'.json',JSON.stringify(data,null,2)+'\n')
for(const c of cases){
 const messages=[...(c.history??[])]
 for(let i=0;i<c.turns.length;i++){
  messages.push({role:'user',text:c.turns[i]});validateRequest({sessionId:'eval',operationId:'eval',messages})
  const start=performance.now();let text='',error=null,ttftMs=null,rawModel=[],source,responsePlan
  const recorder={...provider,stream:async function*(input,signal){let raw='';try{for await(const chunk of provider.stream(input,signal)){raw+=chunk;yield chunk}}finally{rawModel.push({input,raw})}}}
  try{
   const reply=live.createLiveReply(recorder,{messages,system:SYSTEM_INSTRUCTION,maxOutputChars:12000},AbortSignal.timeout(30000));source=reply.source;responsePlan=reply.plan
   for await(const chunk of reply.stream){ttftMs??=Math.round(performance.now()-start);text+=chunk}
  }catch(e){error=e.code||e.message}
  data.results.push({id:c.id,set:c.set,expected:c.expected,target:i===c.turns.length-1,turn:i,messages:[...messages],text,rawModel,responsePlan,source,error,ttftMs,elapsedMs:Math.round(performance.now()-start)})
  messages.push({role:'assistant',text:text||'[no response]'});await save();console.log(`${phase} ${c.id} turn${i} ${source} ${error??'done'}`)
 }
}
data.finished=new Date().toISOString();await save()
