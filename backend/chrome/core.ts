import {explicitChromeQuery} from '../../shared/chromeQuery.js'
import {randomUUID} from 'node:crypto'
import {freemem} from 'node:os'
import {CoreError,uuid} from '../../shared/core.js'
import {parseChromeResearchInput,type ChromeResearchJob} from '../../shared/chromeObservation.js'
import type {createScheduler} from '../core/scheduler.js'
import {startChromeReader,type ChromeReader} from './native.js'
import {proposeChromeQuery,selectChromeResult,assertPublicSearchInstruction} from './planner.js'
type Entry={owner:string;job:ChromeResearchJob;abort:AbortController;deadline:number;automatic?:boolean;settle?:Promise<void>;reader?:ChromeReader;stopping?:Promise<void>}
type Options={windowMode?:'cic-reuse';sessionAllowed?:(owner:string)=>boolean;scheduler:ReturnType<typeof createScheduler>;ownerAlive:(owner:string)=>boolean;externalBusy:()=>boolean;freeMiB?:()=>number;propose?:typeof proposeChromeQuery;select?:typeof selectChromeResult;start?:(query:string,signal:AbortSignal,owner?:string)=>Promise<ChromeReader>;approvalMs?:number}
export function createChromeResearchCore(options:Options){
 const jobs=new Map<string,Entry>(),operations=new Map<string,number>();let fault=false,closed=false
 const busy=()=>fault||[...jobs.values()].some(e=>['planning','waiting-permission','queued','running','cancelling','stop-unverified'].includes(e.job.state))
 const own=(owner:string,id:string)=>{const e=jobs.get(id);if(!e||e.owner!==owner)throw new CoreError('not-found');return e}
 const view=(e:Entry)=>structuredClone(e.job)
 const remember=(owner:string,op:string)=>{const key=owner+':'+op;if(operations.has(key))throw new CoreError('replay');if(operations.size>=128)throw new CoreError('capacity');operations.set(key,performance.now()+600000)}
 async function cancel(e:Entry){if(e.stopping)return e.stopping;e.abort.abort();e.job.state='cancelling';delete e.job.result;return e.stopping=(async()=>{try{await e.reader?.close();await e.settle;if(fault)throw new CoreError('chrome-stop-unverified');e.job.state='cancelled'}catch{fault=true;e.job.state='stop-unverified';e.job.reason='chrome-stop-unverified'}})()}
 const run=(e:Entry,phase:'plan'|'execute')=>{try{options.scheduler.enqueue({id:e.job.taskId,owner:e.owner,reserveMiB:1024,deadline:performance.now()+30000,cancelled:()=>e.abort.signal.aborted,onWait:r=>{e.job.reason=r},onError:r=>{e.job.state=e.abort.signal.aborted?'cancelled':'failed';e.job.reason=r},run:()=>{e.settle=(async()=>{const timeout=setTimeout(()=>e.abort.abort(),90000);timeout.unref();try{
  const began=performance.now();if(!options.ownerAlive(e.owner))throw new CoreError('permission-denied');e.abort.signal.throwIfAborted();delete e.job.reason
  if(phase==='plan'){
   assertPublicSearchInstruction(e.job.instruction);const direct=options.windowMode?explicitChromeQuery(e.job.instruction):null;const query=direct??await(options.propose??proposeChromeQuery)(e.job.instruction,e.abort.signal);if(options.windowMode)e.job.querySource=direct?'explicit':'local-model';e.abort.signal.throwIfAborted();if(!options.ownerAlive(e.owner))throw new CoreError('permission-denied');e.job.query=query;e.deadline=performance.now()+(options.approvalMs??30000);e.job.state='waiting-permission';return
  }
  if(e.automatic&&!options.sessionAllowed?.(e.owner))throw new CoreError('permission-denied');e.job.state='running';e.reader=options.start?await options.start(e.job.query!,e.abort.signal,e.owner):await startChromeReader(e.job.query!,e.abort.signal);e.abort.signal.throwIfAborted()
  let observation;for(let n=0;n<10;n++){try{observation=await e.reader.observe();if(observation.urlVerified&&observation.nodes.some(node=>node.role==='Hyperlink'))break}catch(error){if(!(error instanceof CoreError&&error.code==='document-not-ready'))throw error}await new Promise(r=>setTimeout(r,500));e.abort.signal.throwIfAborted()}
  if(!observation?.urlVerified||observation.query!==e.job.query)throw new CoreError('search-window-unverified')
  const selectedTitle=await(options.select??selectChromeResult)(e.job.query!,observation,e.abort.signal);e.abort.signal.throwIfAborted();if(!options.ownerAlive(e.owner)||e.automatic&&!options.sessionAllowed?.(e.owner))throw new CoreError('permission-denied')
  const current=await e.reader.observe();e.abort.signal.throwIfAborted()
  if(!current.urlVerified||current.instanceId!==observation.instanceId||current.windowId!==observation.windowId||current.pid!==observation.pid||current.startTicks!==observation.startTicks||current.query!==e.job.query)throw new CoreError('search-window-changed')
  if(selectedTitle&&!current.nodes.some(n=>n.role==='Hyperlink'&&n.name===selectedTitle))throw new CoreError('selection-changed')
  await e.reader.close();e.abort.signal.throwIfAborted()
  e.job.result={source:observation.source,query:e.job.query!,title:observation.title,windowId:observation.windowId,windowVerified:true,searchUrlVerified:true,selectionIsProposal:true,...(selectedTitle?{selectedTitle}:{}),model:options.windowMode?'none':'qwen3:0.6b',windowReused:(e.reader as {reused?:boolean}).reused,elapsedMs:Math.round(performance.now()-began)};e.job.state='succeeded'
 }catch(error){delete e.job.result;e.job.reason=error instanceof CoreError?error.code:e.abort.signal.aborted?'cancelled':'chrome-failed';try{await e.reader?.close();if(e.job.reason.includes('stop-unverified'))throw error;e.job.state=e.abort.signal.aborted?'cancelled':'failed'}catch{fault=true;e.job.state='stop-unverified';e.job.reason='chrome-stop-unverified'}}finally{clearTimeout(timeout)}})().then(()=>{
    // Enqueue after the planning slot is released; never use model output as a grant.
    if(phase==='plan'&&e.job.state==='waiting-permission'&&options.sessionAllowed?.(e.owner)){
      const timer=setTimeout(()=>{if(closed||fault||e.abort.signal.aborted||e.job.state!=='waiting-permission'||!options.ownerAlive(e.owner)||!options.sessionAllowed?.(e.owner))return;e.automatic=true;e.job.state='queued';try{run(e,'execute')}catch{e.job.state='failed';e.job.reason='busy'}},0);timer.unref()
    }
  });return e.settle}})}catch(error){e.job.state='failed';e.job.reason='busy';throw error}}
 const gc=setInterval(()=>{for(const [key,expires]of operations)if(expires<performance.now())operations.delete(key);for(const e of jobs.values()){if(!options.ownerAlive(e.owner)||e.job.state==='waiting-permission'&&e.deadline<performance.now())void cancel(e);if(['succeeded','failed','cancelled'].includes(e.job.state)&&e.deadline+600000<performance.now())jobs.delete(e.job.taskId)}},250);gc.unref()
 return{
  plan(owner:string,value:unknown){if(closed||busy()||options.externalBusy())throw new CoreError('busy');if(!options.ownerAlive(owner))throw new CoreError('permission-denied');const free=(options.freeMiB??(()=>freemem()/1048576))();if(!Number.isFinite(free)||free<1536)throw new CoreError('memory');const input=parseChromeResearchInput(value);remember(owner,input.operationId);if(jobs.size>=12){const old=[...jobs.values()].find(e=>e.owner===owner&&e.job.state==='cancelled'&&!e.job.result&&(!e.reader||!e.reader.alive()));if(old)jobs.delete(old.job.taskId);else throw new CoreError('capacity')}const e:Entry={owner,abort:new AbortController(),deadline:performance.now()+30000,job:{version:1,taskId:randomUUID(),operationId:input.operationId,instruction:input.instruction,...(options.windowMode?{windowMode:options.windowMode}:{}),state:'planning'}};jobs.set(e.job.taskId,e);run(e,'plan');return view(e)},
  approve(owner:string,id:string,automatic=false){const e=own(owner,id);if(automatic&&!options.sessionAllowed?.(owner))throw new CoreError('permission-denied');if(closed||fault||e.job.state!=='waiting-permission'||e.deadline<performance.now()||e.abort.signal.aborted||!options.ownerAlive(owner))throw new CoreError('permission-denied');if(options.externalBusy())throw new CoreError('busy');const free=(options.freeMiB??(()=>freemem()/1048576))();if(!Number.isFinite(free)||free<1536)throw new CoreError('memory');e.automatic=automatic;e.job.state='queued';const timer=setTimeout(()=>{if(closed||fault||e.abort.signal.aborted||e.job.state!=='queued')return;if(!options.ownerAlive(e.owner)||e.automatic&&!options.sessionAllowed?.(e.owner)){e.job.state='failed';e.job.reason='permission-denied';return}try{run(e,'execute')}catch{e.job.state='failed';e.job.reason='busy'}},0);timer.unref();return view(e)},
  get:(owner:string,id:string)=>view(own(owner,id)),
  async cancelOperation(owner:string,op:string){if(!uuid(op))throw new CoreError('invalid');if(!operations.has(owner+':'+op))remember(owner,op);const e=[...jobs.values()].find(e=>e.owner===owner&&e.job.operationId===op);if(e)await cancel(e)},
  async stop(owner:string){await Promise.all([...jobs.values()].filter(e=>e.owner===owner).map(cancel));return{settled:!fault&&[...jobs.values()].filter(e=>e.owner===owner).every(e=>e.job.state==='cancelled'),chromeWindowsClosed:false}},
  isBusy:busy,
  async close(){closed=true;clearInterval(gc);for(const e of jobs.values())await cancel(e);operations.clear()},
 }
}
