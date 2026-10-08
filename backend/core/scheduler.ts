import {CoreError} from '../../shared/core.js'
export type Scheduled={id:string;owner:string;deadline:number;cancelled:()=>boolean;onWait:(reason:string)=>void;run:()=>Promise<void>;onError:(code:string)=>void}
export function createScheduler(options:{freeMiB:()=>number;externalBusy:()=>boolean;clock?:()=>number}){
 const clock=options.clock??(()=>performance.now());let closed=false,active:Scheduled|null=null,timer:ReturnType<typeof setTimeout>|undefined;const queue:Scheduled[]=[]
 const arm=()=>{if(!closed&&!timer&&queue.length){timer=setTimeout(()=>{timer=undefined;pump()},50);timer.unref()}}
 function pump(){
  if(closed||active){arm();return}
  for(let i=queue.length-1;i>=0;i--)if(queue[i].cancelled()||queue[i].deadline<=clock()){const [item]=queue.splice(i,1);item.onError(item.cancelled()?'cancelled':'timeout')}
  if(!queue.length)return
  const free=options.freeMiB(),blocked=options.externalBusy()?'legacy-busy':!Number.isFinite(free)||free<520?'memory':null
  if(blocked){for(const item of queue)item.onWait(blocked);arm();return}
  const item=queue.shift()!;active=item
  // The slot is held until the actual executor/cleanup promise settles, not a race with abort.
  void item.run().catch(()=>item.onError('failed')).finally(()=>{if(active===item)active=null;pump()})
 }
 return {
  enqueue(item:Scheduled){if(closed)throw new CoreError('closed');if(queue.length>=2||queue.some(j=>j.owner===item.owner)||active?.owner===item.owner)throw new CoreError('busy');queue.push(item);pump()},
  remove(id:string){const i=queue.findIndex(j=>j.id===id);if(i>=0)queue.splice(i,1);arm()},
  busy:()=>!!active,
  snapshot:()=>({active:active?1:0,queued:queue.length,heavyLimit:1,queueLimit:2}),
  close(){closed=true;if(timer)clearTimeout(timer);for(const item of queue.splice(0))item.onError('cancelled')},
 }
}

