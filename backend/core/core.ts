import {randomUUID} from 'node:crypto'
import {freemem} from 'node:os'
import {CoreError,parseCorePlan,type CoreJob,type CoreState} from '../../shared/core.js'
import {createPolicy,type ActionEnvelope} from './policy.js'
import {createScheduler} from './scheduler.js'
import {boundedPlan,registry,type RegisteredTool} from './registry.js'
type Stored={owner:string;job:CoreJob;created:number;deadline:number;grant?:string;abort:AbortController;deadlineTimer?:ReturnType<typeof setTimeout>;expiryTimer?:ReturnType<typeof setTimeout>;graceTimer?:ReturnType<typeof setTimeout>;settled:boolean}
export function createCore(options:{externalBusy?:()=>boolean;ownerAlive?:(owner:string)=>boolean;freeMiB?:()=>number;clock?:()=>number;tools?:readonly RegisteredTool[];deadlineMs?:number;stopGraceMs?:number}={}){
 const clock=options.clock??(()=>performance.now()),policy=createPolicy(clock),jobs=new Map<string,Stored>(),operations=new Map<string,ReturnType<typeof setTimeout>>();let closed=false
 const tools=options.tools??registry();if(tools.length!==2||new Set(tools.map(t=>t.id)).size!==2||tools.some(t=>!['calculator','time-calculator'].includes(t.id)||t.native!==false||t.reserveMiB!==8||t.permission!=='tools.calculate'))throw new CoreError('registry')
 const scheduler=createScheduler({clock,freeMiB:options.freeMiB??(()=>freemem()/1048576),externalBusy:options.externalBusy??(()=>false)})
 const state=(s:Stored,next:CoreState,reason?:string)=>{if(s.job.state===next&&s.job.reason===reason)return;s.job.state=next;s.job.reason=reason;if(s.job.events.length<24)s.job.events.push({sequence:s.job.events.length,state:next,elapsedMs:Math.max(0,clock()-s.created),...(reason?{reason}:{})})}
 const view=(s:Stored):CoreJob=>structuredClone(s.job)
 const owned=(owner:string,id:string)=>{const s=jobs.get(id);if(!s||s.owner!==owner)throw new CoreError('not-found');return s}
 function remember(owner:string,op:string){const k=owner+':'+op;if(operations.has(k))throw new CoreError('replay');if(operations.size>=128)throw new CoreError('capacity');const t=setTimeout(()=>operations.delete(k),600000);t.unref();operations.set(k,t)}
 function cancel(s:Stored,reason='cancelled'){
  if(s.grant)policy.revoke(s.grant)
  if(['succeeded','failed','cancelled'].includes(s.job.state))return
  s.abort.abort(new CoreError(reason));delete s.job.result
  if(s.job.state==='running'||s.job.state==='verifying'||s.job.state==='cancelling'||s.job.state==='stop-unverified'){
   state(s,'cancelling',reason);if(!s.graceTimer){s.graceTimer=setTimeout(()=>{if(!s.settled)state(s,'stop-unverified','executor-not-settled')},options.stopGraceMs??100);s.graceTimer.unref()}
  }else{state(s,reason==='timeout'?'failed':'cancelled',reason);scheduler.remove(s.job.taskId)}
 }
 async function execute(s:Stored){
  state(s,'running');s.settled=false
  try{
   await Promise.resolve();s.abort.signal.throwIfAborted()
   const a:ActionEnvelope={version:1,policyVersion:1,taskId:s.job.taskId,sessionId:s.owner,operationId:s.job.operationId,agentId:'UtilityAgent',toolId:s.job.toolId,args:s.job.args,grantId:s.grant!,target:{kind:'local-tool',id:s.job.toolId},observationId:null,geometryVersion:null,deadline:s.deadline,preconditions:['owned-reviewed-plan'],postconditions:['exact-tool-output']}
   if(options.ownerAlive&&!options.ownerAlive(s.owner))throw new CoreError('permission-denied');if(options.externalBusy?.())throw new CoreError('legacy-busy');policy.consume(s.owner,a);s.abort.signal.throwIfAborted()
   const tool=tools.find(t=>t.id===s.job.toolId)!,output=await tool.execute(s.job.args.expression,s.abort.signal)
   s.abort.signal.throwIfAborted();if(clock()>=s.deadline)throw new CoreError('timeout');state(s,'verifying')
   const text=tool.verify(s.job.args.expression,output);s.abort.signal.throwIfAborted()
   s.job.result={text,source:s.job.toolId,evidence:'NATIVE-TOOL',verified:true};state(s,'succeeded')
  }catch(e){delete s.job.result;const cause=s.abort.signal.reason instanceof CoreError?s.abort.signal.reason.code:'cancelled';state(s,s.abort.signal.aborted&&cause!=='timeout'?'cancelled':'failed',s.abort.signal.aborted?cause:e instanceof CoreError?e.code:'tool-failed')}
  finally{s.settled=true;if(s.deadlineTimer)clearTimeout(s.deadlineTimer);if(s.graceTimer)clearTimeout(s.graceTimer)}
 }
 return {
  plan(owner:string,value:unknown){
   if(closed)throw new CoreError('closed');const input=parseCorePlan(value),p=boundedPlan(input.instruction)
   if(jobs.size>=32||[...jobs.values()].filter(s=>s.owner===owner).length>=8)throw new CoreError('capacity');remember(owner,input.operationId)
   const created=clock(),s:Stored={owner,created,deadline:created+(options.deadlineMs??30000),abort:new AbortController(),settled:true,job:{version:1,taskId:randomUUID(),operationId:input.operationId,state:'idle',toolId:p.toolId,agentId:'UtilityAgent',args:p.args,events:[]}}
   jobs.set(s.job.taskId,s);state(s,'idle','created');state(s,'planned','typed-parser');state(s,'waiting-permission')
   s.deadlineTimer=setTimeout(()=>cancel(s,'timeout'),options.deadlineMs??30000);s.deadlineTimer.unref()
   s.expiryTimer=setTimeout(()=>{if(s.settled){if(s.grant)policy.remove(s.grant);jobs.delete(s.job.taskId)}else cancel(s,'expired')},600000);s.expiryTimer.unref()
   return view(s)
  },
  approve(owner:string,id:string){const s=owned(owner,id);if(closed||s.job.state!=='waiting-permission'||s.abort.signal.aborted||clock()>=s.deadline)throw new CoreError('permission-denied')
   s.grant=policy.issue(owner,id,s.job.operationId,s.job.toolId,s.job.args.expression,s.deadline);state(s,'queued')
   try{scheduler.enqueue({id,owner,deadline:s.deadline,cancelled:()=>s.abort.signal.aborted,onWait:r=>{s.job.reason=r},run:()=>execute(s),onError:r=>cancel(s,r)})}catch(e){policy.revoke(s.grant);state(s,'failed',e instanceof CoreError?e.code:'failed');throw e}return view(s)
  },
  get:(owner:string,id:string)=>view(owned(owner,id)),
  cancel(owner:string,id:string){const s=owned(owner,id);cancel(s);return view(s)},
  cancelOperation(owner:string,op:string){const s=[...jobs.values()].find(s=>s.owner===owner&&s.job.operationId===op);if(s){cancel(s);return}if(!operations.has(owner+':'+op))remember(owner,op)},
  stop(owner:string){for(const s of jobs.values())if(s.owner===owner)cancel(s);return {acknowledged:true,settled:![...jobs.values()].some(s=>s.owner===owner&&!s.settled)}},
  isBusy:scheduler.busy,
  close(){closed=true;for(const s of jobs.values()){cancel(s);for(const t of [s.deadlineTimer,s.expiryTimer,s.graceTimer])if(t)clearTimeout(t)}scheduler.close();policy.close();for(const t of operations.values())clearTimeout(t);operations.clear()},
 }
}
