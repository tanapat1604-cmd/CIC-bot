import {readFile,writeFile,access,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createOllamaProvider,ollamaConfig} from '../.backend-build/backend/ollama.js'
import {SYSTEM_INSTRUCTION} from '../.backend-build/backend/provider.js'
const phase=process.argv[2]
if(!['baseline','baseline-extra','development','development-v2','holdout'].includes(phase))throw Error('Unknown phase')
const folder='validation/2026-10-04-intent/'
try{await access(folder+phase+'.json');throw Error('Evidence exists')}catch(e){if(e.code!=='ENOENT')throw e}
if(phase==='holdout'){
 const freeze=JSON.parse((await readFile(folder+'FINAL-FREEZE.json','utf8')).replace(/^\uFEFF/,''))
 for(const item of freeze.hashes)if(createHash('sha256').update(await readFile(item.file)).digest('hex').toUpperCase()!==item.sha256)throw Error('Changed after freeze: '+item.file)
}
// Bootstrap the exact archived old router; does not depend on an untracked helper being present.
await mkdir('.tools',{recursive:true})
await writeFile('.tools/intent-baseline.mjs',await readFile(folder+'baseline-router.txt'))
const {resolveTextUtility:baseline}=await import('../.tools/intent-baseline.mjs')
const cases=JSON.parse(await readFile('scripts/intent-cases.json','utf8')).filter(c=>phase==='holdout'?c.set==='holdout':phase==='baseline-extra'?c.set==='development'&&c.id.startsWith('x-'):c.set!=='holdout')
const config=ollamaConfig({AI_MODEL:'qwen3:0.6b'})
const provider=createOllamaProvider(config)
const {resolveTextUtility:final}=await import('../.backend-build/backend/textUtilities.js')
const data={phase,started:new Date().toISOString(),config,system:SYSTEM_INSTRUCTION,results:[]}
const save=()=>writeFile(folder+phase+'.json',JSON.stringify(data,null,2)+'\n')
for(const variant of phase==='holdout'?['baseline','final']:[phase.startsWith('baseline')?'baseline':'final'])for(const c of cases){
 const messages=[]
 for(let i=0;i<c.turns.length;i++){
  messages.push({role:'user',text:c.turns[i]})
  const start=performance.now();let text='',error=null,ttftMs=null,source='model'
  const result=variant==='baseline'?baseline(c.turns[i]):final(c.turns[i],messages)
  try{
   if(result){text=result.text;source=result.source;ttftMs=0}
   else for await(const chunk of provider.stream({messages,system:SYSTEM_INSTRUCTION,maxOutputChars:12000},AbortSignal.timeout(30000))){ttftMs??=Math.round(performance.now()-start);text+=chunk}
  }catch(e){error=e.code||e.message}
  data.results.push({variant,id:c.id,pair:c.pair,set:c.set,expected:c.expected,target:i===c.turns.length-1,turn:i,messages:[...messages],text,source,error,ttftMs,elapsedMs:Math.round(performance.now()-start)})
  messages.push({role:'assistant',text:text||'[no response]'})
  await save();console.log(`${variant} ${c.id} turn${i} ${source} ${error??'done'}`)
 }
}
data.finished=new Date().toISOString();await save()
