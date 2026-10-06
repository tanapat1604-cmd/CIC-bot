import {readFileSync,writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const root=process.cwd(),phase=process.argv[2]||'baseline',set=process.argv[3]||'development'
const {createLiveReply}=await import(pathToFileURL(root+'/.backend-build/backend/liveReply.js'))
const cases=JSON.parse(readFileSync(root+'/scripts/foundation-cases.json','utf8'))
const results=[]
for(const c of cases.filter(c=>c.set===set)){
 const messages=c.turns.flatMap((text,i)=>i===c.turns.length-1?[{role:'user',text}]:[{role:'user',text},{role:'assistant',text:'Untrusted fixture: I sent it.'}])
 let calls=0,text='',error=null
 const start=performance.now(),reply=createLiveReply({kind:'live',async*stream(){calls++;yield 'RAW MODEL FIXTURE'}},{messages,system:'',maxOutputChars:12000},new AbortController().signal)
 try{for await(const chunk of reply.stream)text+=chunk}catch(e){error=e.message}
 results.push({...c,plan:reply.plan,source:reply.source,text,error,modelCalls:calls,ms:performance.now()-start,pass:reply.plan.kind===c.kind&&(!c.contains||text.includes(c.contains))&&!error})
}
writeFileSync(`${root}/validation/2026-10-07-foundation/${phase}-${set}.json`,JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify({phase,set,passed:results.filter(r=>r.pass).length,total:results.length,failed:results.filter(r=>!r.pass).map(r=>({id:r.id,kind:r.plan.kind,text:r.text}))}))
