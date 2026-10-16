import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createChromeWindows,type ChromeWindow} from '../backend/chrome/sequence'
import {createChromeResearchCore} from '../backend/chrome/core'
import {createScheduler} from '../backend/core/scheduler'
import {CoreError} from '../shared/core'
import {parseChromeResearchJob} from '../shared/chromeObservation'
import {explicitChromeQuery} from '../shared/chromeQuery'
import {chooseTypedTool} from '../src/voice/toolChoice'
import {needsAssistant} from '../src/voice/assistantChoice'
const corpus=JSON.parse(readFileSync('validation/2026-10-13-chrome-reuse/9000-new-cases.json','utf8')) as {cases:{id:string;category:string;topic:string;raw?:string;ops?:string[];change?:boolean;parameter?:number}[]}
const signal=()=>new AbortController().signal
function deferred(){let resolve:()=>void=()=>{};const promise=new Promise<void>(r=>resolve=r);return{promise,resolve}}
function windowFixture(){let starts=0,live=false,closeCount=0,stopCount=0,shows=0,query='',allowed=true,alive=true,changed=false,stopOK=true,closeOK=true,observes=0,mutation='',gate:ReturnType<typeof deferred>|null=null;const seen:string[]=[]
 const window:ChromeWindow={alive:()=>live,id:()=>String(7000+starts),show:async()=>{if(changed)throw new CoreError('chrome-window-changed');shows++},openYouTube:async s=>{s.throwIfAborted();if(changed)throw new CoreError('chrome-window-changed');query='youtube-home'},search:async(q,s)=>{s.throwIfAborted();if(changed)throw new CoreError('chrome-window-changed');if(gate)await gate.promise;s.throwIfAborted();query=q;seen.push(q)},stop:async()=>{stopCount++;return{settled:stopOK}},close:async()=>{closeCount++;if(!closeOK)throw new CoreError('chrome-stop-unverified');if(changed)throw new CoreError('chrome-window-changed');live=false},observe:async()=>{if(changed)throw new CoreError('chrome-window-changed');observes++;const observationId=randomUUID(),n=observes>1;return{source:'owned-chrome-dom',readOnly:true,instanceId:'123e4567-e89b-42d3-a456-426614174000',observationId,windowId:String(7000+starts+(n&&mutation==='window'?1:0)),pid:n&&mutation==='pid'?999:123,startTicks:n&&mutation==='birth'?'999':'123456',query:n&&mutation==='query'?'other-query':query,urlVerified:!(n&&mutation==='url'),title:'Google '+query,nodes:[{reference:observationId+':0',role:'Hyperlink',name:'Observed '+query,enabled:true,contentLink:true}],truncated:false,elapsedMs:1,geometry:{left:0,top:0,right:800,bottom:600}}}}
 const pool=createChromeWindows({start:async()=>{starts++;if(gate)await gate.promise;live=true;return window},ownerAlive:()=>alive,allowed:()=>allowed})
 return{pool,window,seen,get starts(){return starts},get closes(){return closeCount},get stops(){return stopCount},get shows(){return shows},get query(){return query},get live(){return live},set allowed(v:boolean){allowed=v},set ownerAlive(v:boolean){alive=v},set changed(v:boolean){changed=v},set stopOK(v:boolean){stopOK=v},set closeOK(v:boolean){closeOK=v},set lost(v:boolean){live=!v},set mutation(v:string){mutation=v},hold(){gate=deferred();return gate},unhold(){gate?.resolve();gate=null},async close(){gate?.resolve();changed=false;closeOK=true;stopOK=true;await pool.close()}}
}
async function stateMachine(c:typeof corpus.cases[number]){
 const f=windowFixture(),owner='owned-'+c.id,foreign='foreign-'+c.id;
 const oracle={permission:true,entry:false,live:false,started:false,starts:0,query:'',id:''};
 try{for(const [n,op] of c.ops!.entries()){
  const q=c.topic+' step '+n;
  if(op==='deny'){oracle.permission=false;f.allowed=false;continue}
  if(op==='allow'){oracle.permission=true;f.allowed=true;continue}
  if(op==='lose'){if(oracle.entry){oracle.live=false;f.lost=true}continue}
  const isForeign=op.startsWith('foreign-'),kind=op.replace('foreign-',''),who=isForeign?foreign:owner;
  let error:string|null=null;
  if(kind==='open'||kind==='search'){
   if(!oracle.permission)error='permission-denied';else if(isForeign&&oracle.started)error='chrome-owner-conflict';
   else if(kind==='search'&&oracle.started&&!oracle.live)error='chrome-window-closed';
   // Foreign-first operations are intentionally a separate ownership scenario;
   // establish the owner explicitly before testing the foreign boundary.
   if(isForeign&&!oracle.started){const first=await f.pool.open(owner,'chrome',signal()).catch(e=>e);if(oracle.permission){oracle.entry=true;oracle.live=true;oracle.started=true;oracle.starts++;oracle.id=(first as {windowId:string}).windowId;error='chrome-owner-conflict'}else error='permission-denied'}
   const call=()=>kind==='open'?f.pool.open(who,'chrome',signal()):f.pool.search(who,q,signal());
   if(error)await expect(call(),c.id+' step '+n+' '+op).rejects.toThrow(error);
   else{const reused=oracle.entry&&oracle.live;if(!oracle.live){oracle.entry=true;oracle.live=true;oracle.started=true;oracle.starts++;oracle.id=String(7000+oracle.starts)}
    if(kind==='open'){const receipt=await call() as Awaited<ReturnType<typeof f.pool.open>>;expect(receipt.windowId).toBe(oracle.id);expect(receipt.reused).toBe(reused)}
    else{const lease=await call() as Awaited<ReturnType<typeof f.pool.search>>;oracle.query=q;const seen=await lease.observe();expect(seen.windowId).toBe(oracle.id);expect(seen.query).toBe(q);await lease.close()}
   }
  }else if(kind==='pause'){const stops=f.stops;expect((await f.pool.pause(who)).settled).toBe(true);if(isForeign)expect(f.stops).toBe(stops)}
  else if(kind==='release'){const result=await f.pool.release(who);expect(result.settled).toBe(true);expect(result.chromeWindowsClosed).toBe(!isForeign&&oracle.entry);if(!isForeign&&oracle.entry){oracle.entry=false;oracle.live=false;oracle.started=false;oracle.query='';oracle.id=''}}
  expect(f.starts,c.id+' step '+n).toBe(oracle.starts);expect(f.live).toBe(oracle.live);
 }}finally{f.allowed=true;await f.close()}
}
async function stableInstance(c:typeof corpus.cases[number]){
 const f=windowFixture(),owner=c.id,scheduler=createScheduler({freeMiB:()=>4096,externalBusy:()=>false});let observations=0;
 const core=createChromeResearchCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,windowMode:'cic-reuse',propose:async()=>{throw Error('unneeded model')},start:async(q,s,o)=>{const reader=await f.pool.search(o!,q,s);return{...reader,observe:async()=>{const value=await reader.observe();observations++;return{...value,instanceId:c.change&&observations>1?randomUUID():value.instanceId}}}},select:async(_q,observation)=>observation.nodes[0].name});
 const tick=()=>new Promise<void>(r=>setImmediate(r));
 try{const j=core.plan(owner,{version:1,operationId:randomUUID(),instruction:'ค้นหา '+c.topic});for(let n=0;n<1000&&core.get(owner,j.taskId).state==='planning';n++)await tick();expect(core.get(owner,j.taskId).state).toBe('waiting-permission');core.approve(owner,j.taskId);for(let n=0;n<1000&&!['succeeded','failed'].includes(core.get(owner,j.taskId).state);n++)await tick();const result=core.get(owner,j.taskId);expect(result.state).toBe(c.change?'failed':'succeeded');if(c.change){expect(result.reason).toBe('search-window-changed');expect(result.result).toBeUndefined()}else expect(parseChromeResearchJob(result).result?.query).toBe(c.topic);expect(f.starts).toBe(1)}finally{await core.close();scheduler.close();await f.close()}
}
for(const c of corpus.cases)test(c.id+' '+c.category,async()=>{if(c.category==='state')await stateMachine(c);else if(c.category==='identity')await stableInstance(c);else{expect(explicitChromeQuery(c.raw!)).toBe(c.topic);const choice=chooseTypedTool(c.raw!,null);expect(choice.kind).toBe('research');if(choice.kind!=='research')throw Error('wrong tool');expect(explicitChromeQuery(choice.instruction)).toBe(c.topic);expect(needsAssistant(c.raw!,choice,null)).toBe(false)}})
