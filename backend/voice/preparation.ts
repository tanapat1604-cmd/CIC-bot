import {randomUUID} from 'node:crypto'
import {CoreError,exact,uuid} from '../../shared/core.js'
import {parseVoiceRequest,parseVoiceJob,type VoiceRequest,type VoiceJob} from '../../shared/voice.js'
import type {createScheduler} from '../core/scheduler.js'
import {prepareAsr,speechFailureTimings,type OwnedSpeechWorker,type VoiceConfig} from './runtime.js'
type Stored={owner:string;turnId:string;job:VoiceJob;abort:AbortController;deadline:number;submitted:boolean;worker?:OwnedSpeechWorker;opening?:Promise<OwnedSpeechWorker>;settle?:Promise<void>;release:(input:VoiceRequest)=>void;timer:ReturnType<typeof setTimeout>;stopping?:Promise<boolean>}
export function createAsrPreparation(options:{config:VoiceConfig|null;scheduler:ReturnType<typeof createScheduler>;ownerAlive:(who:string)=>boolean;externalBusy:()=>boolean;freeMiB:()=>number;open?:typeof prepareAsr;expiryMs?:number}){
 const jobs=new Map<string,Stored>();let fault=false,closed=false
 const alive=(s:Stored)=>!s.abort.signal.aborted&&options.ownerAlive(s.owner)
 const owned=(who:string,op:string)=>{const s=jobs.get(op);if(!s||s.owner!==who)throw new CoreError('not-found');return s}
 async function cancel(s:Stored):Promise<boolean>{if(s.stopping)return s.stopping;s.abort.abort();options.scheduler.remove(s.job.taskId);delete s.job.result;s.job.state='cancelling';s.stopping=(async()=>{try{if(s.opening)await s.opening.catch(()=>{});await s.worker?.stop();await s.settle;if(s.job.reason==='voice-stop-unverified')return false;s.job.state='cancelled';return true}catch{fault=true;s.job.reason='voice-stop-unverified';s.job.state='stop-unverified';return false}})();return s.stopping}
 const gc=setInterval(()=>{for(const s of jobs.values())if(!options.ownerAlive(s.owner)||!s.submitted&&performance.now()>=s.deadline)void cancel(s)},100);gc.unref()
 return{
  begin(who:string,value:unknown){
   if(!exact(value,['version','operationId','turnId','acknowledged','captureStarted'])||value.version!==1||!uuid(value.operationId)||!uuid(value.turnId)||value.acknowledged!==true||value.captureStarted!==true)throw new CoreError('invalid')
   if(closed||fault||options.externalBusy()||[...jobs.values()].some(s=>['queued','running','cancelling','stop-unverified'].includes(s.job.state)))throw new CoreError('busy')
   if(!options.ownerAlive(who))throw new CoreError('permission-denied');if(!options.config)throw new CoreError('voice-not-configured')
   if(jobs.has(value.operationId))throw new CoreError('replay');const free=options.freeMiB();if(!Number.isFinite(free)||free<(options.config?.asrModel==='wav2vec2-thai-cpu-int8'?4096:2048))throw new CoreError('voice-memory')
   if(jobs.size>=12){const old=[...jobs.entries()].find(([,s])=>s.job.state==='cancelled');if(!old)throw new CoreError('capacity');clearTimeout(old[1].timer);jobs.delete(old[0])}
   let release:(v:VoiceRequest)=>void=()=>{};const input=new Promise<VoiceRequest>(resolve=>release=resolve),queuedAt=performance.now(),s:Stored={owner:who,turnId:value.turnId,abort:new AbortController(),deadline:queuedAt+(options.expiryMs??30000),submitted:false,release,timer:setTimeout(()=>{void cancel(s).then(ok=>{if(ok)jobs.delete(s.job.operationId)})},120000),job:{version:1,taskId:randomUUID(),operationId:value.operationId,kind:'asr',state:'queued'}};s.timer.unref();jobs.set(value.operationId,s)
   const aborted=new Promise<never>((_,reject)=>s.abort.signal.addEventListener('abort',()=>reject(new CoreError('cancelled')),{once:true}));void aborted.catch(()=>{})
   try{options.scheduler.enqueue({id:s.job.taskId,owner:who,reserveMiB:options.config?.asrModel==='wav2vec2-thai-cpu-int8'?2048:1024,deadline:s.deadline,cancelled:()=>s.abort.signal.aborted,onWait:reason=>s.job.reason=reason,onError:reason=>{s.job.state=s.abort.signal.aborted?'cancelled':'failed';s.job.reason=reason},run:()=>{s.settle=(async()=>{
    const queueMs=Math.round(performance.now()-queuedAt)
    try{if(!alive(s))throw new CoreError('permission-denied');s.job.state='running';delete s.job.reason;s.opening=(options.open??prepareAsr)(s.abort.signal,options.config!);s.worker=await s.opening;await s.worker.ready;const request=await Promise.race([input,aborted]);if(!alive(s))throw new CoreError('cancelled');const result=await s.worker.submit(request);if(!alive(s))throw new CoreError('cancelled');await s.worker.exited;if(!alive(s))throw new CoreError('cancelled');s.job.result={text:result.text,language:result.language??'th',elapsedMs:result.elapsedMs,peakWorkingSetMiB:result.peakWorkingSetMiB,timings:{...result.timings,queueMs},asrModel:options.config!.asrModel??'faster-whisper-base-cpu-int8',asrDecodeProfile:options.config!.asrDecodeProfile??'legacy',workerHash:options.config!.workerHash};s.job.timings=s.job.result.timings;s.job.state='succeeded';parseVoiceJob(s.job)
    }catch(e){delete s.job.result;s.job.timings={...speechFailureTimings(e),queueMs};s.job.reason=e instanceof CoreError?e.code:'voice-runtime-failed';if(s.job.reason==='voice-stop-unverified'){fault=true;s.job.state='stop-unverified'}else s.job.state=s.abort.signal.aborted?'cancelled':'failed'}
    finally{try{await s.worker?.stop()}catch{fault=true;delete s.job.result;s.job.reason='voice-stop-unverified';s.job.state='stop-unverified';// Keep the heavy slot until actual exit, even after a failed Stop receipt.
      await s.worker?.exited}}
   })();return s.settle}})}catch(e){clearTimeout(s.timer);jobs.delete(s.job.operationId);throw e}
   return{version:1,prototype:true,operationId:s.job.operationId,turnId:s.turnId,expiresInMs:options.expiryMs??30000}
  },
  submit(who:string,value:unknown){if(!exact(value,['version','operationId','turnId','acknowledged','tracksClosed','pcm','language'])||value.tracksClosed!==true||!uuid(value.turnId))throw new CoreError('invalid');const request=parseVoiceRequest({version:value.version,operationId:value.operationId,acknowledged:value.acknowledged,kind:'asr',pcm:value.pcm,language:value.language});const s=owned(who,request.operationId);if(fault||closed||!alive(s)||s.turnId!==value.turnId||performance.now()>=s.deadline||!['queued','running'].includes(s.job.state))throw new CoreError('permission-denied');if(s.submitted)throw new CoreError('replay');const pcm=Buffer.from(request.kind==='asr'?request.pcm:'','base64');if(pcm.length<8000||pcm.length>480000||pcm.length%2||pcm.toString('base64')!==value.pcm)throw new CoreError('invalid-audio');s.submitted=true;s.release(request);return structuredClone(s.job)},
  get(who:string,id:string){const s=[...jobs.values()].find(s=>s.job.taskId===id);if(!s||s.owner!==who)throw new CoreError('not-found');return structuredClone(s.job)},
  has:(id:string)=>[...jobs.values()].some(s=>s.job.taskId===id),
  async cancelOperation(who:string,op:string){const s=jobs.get(op);if(s&&s.owner===who)return cancel(s);return true},
  async stop(who:string){return(await Promise.all([...jobs.values()].filter(s=>s.owner===who).map(cancel))).every(Boolean)},
  busy:()=>fault||[...jobs.values()].some(s=>['queued','running','cancelling','stop-unverified'].includes(s.job.state)),
  fault:()=>fault,
  async close(){closed=true;clearInterval(gc);for(const s of jobs.values()){clearTimeout(s.timer);await cancel(s)}},
 }
}
