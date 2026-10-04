import {readFile,writeFile,access,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createOllamaProvider,ollamaConfig} from '../.backend-build/backend/ollama.js'
import {SYSTEM_INSTRUCTION} from '../.backend-build/backend/provider.js'
import {validateRequest} from '../.backend-build/shared/chatProtocol.js'
const phase=process.argv[2],folder='validation/2026-10-04-mixed/'
if(!['baseline','system-dev','prompt-dev','holdout'].includes(phase))throw Error('Unknown phase')
try{await access(folder+phase+'.json');throw Error('Evidence exists')}catch(e){if(e.code!=='ENOENT')throw e}
const plan=JSON.parse(await readFile(folder+'PLAN.json','utf8'))
if(phase==='holdout'){
 const freeze=JSON.parse((await readFile(folder+'FINAL-FREEZE.json','utf8')).replace(/^\uFEFF/,''))
 for(const item of freeze.hashes)if(createHash('sha256').update(await readFile(item.file)).digest('hex').toUpperCase()!==item.sha256)throw Error('Changed after freeze: '+item.file)
}
await mkdir('.tools',{recursive:true})
for(const name of ['intent','utilities'])await writeFile('.tools/mixed-baseline-'+name+'.mjs',await readFile(folder+'baseline-'+name+'.txt'))
const {resolveTextUtility:baseline}=await import('../.tools/mixed-baseline-utilities.mjs')
const cases=JSON.parse(await readFile('scripts/mixed-cases.json','utf8')).filter(c=>phase==='holdout'?c.set==='holdout':c.set!=='holdout')
const config=ollamaConfig({AI_MODEL:'qwen3:0.6b'}),provider=createOllamaProvider(config)
let live
if(phase!=='baseline')live=await import('../.backend-build/backend/liveReply.js')
const data={phase,started:new Date().toISOString(),config,system:SYSTEM_INSTRUCTION,baselineSystem:plan.baselineSystem,results:[]}
const save=()=>writeFile(folder+phase+'.json',JSON.stringify(data,null,2)+'\n')
for(const variant of phase==='holdout'?['baseline','final']:[phase==='baseline'?'baseline':'final'])for(const c of cases){
 const messages=[...(c.history??[])]
 for(let i=0;i<c.turns.length;i++){
  messages.push({role:'user',text:c.turns[i]})
  validateRequest({sessionId:'eval',operationId:'eval',messages})
  const start=performance.now();let text='',error=null,ttftMs=null,source='model',rawModel=[],responsePlan=null
  const recorder={...provider,stream:async function*(input,signal){let raw='';try{for await(const chunk of provider.stream(input,signal)){raw+=chunk;yield chunk}}finally{rawModel.push({input,raw})}}}
  try{
   let stream
   if(variant==='baseline'){
    const result=baseline(c.turns[i],messages)
    if(result){source=result.source;stream=(async function*(){yield result.text})()}
    else stream=recorder.stream({messages,system:plan.baselineSystem,maxOutputChars:12000},AbortSignal.timeout(30000))
   }else{const reply=live.createLiveReply(recorder,{messages,system:SYSTEM_INSTRUCTION,maxOutputChars:12000},AbortSignal.timeout(30000));source=reply.source;stream=reply.stream;responsePlan=reply.plan}
   for await(const chunk of stream){ttftMs??=Math.round(performance.now()-start);text+=chunk}
  }catch(e){error=e.code||e.message}
  data.results.push({variant,id:c.id,set:c.set,expected:c.expected,target:i===c.turns.length-1,turn:i,messages:[...messages],messageCount:messages.length,totalChars:messages.reduce((n,m)=>n+m.text.length,0),text,rawModel,responsePlan,source,error,ttftMs,elapsedMs:Math.round(performance.now()-start),utilityExpected:c.utility})
  messages.push({role:'assistant',text:text||'[no response]'})
  await save();console.log(`${variant} ${c.id} turn${i} ${source} ${error??'done'}`)
 }
}
data.finished=new Date().toISOString();await save()
