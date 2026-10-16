import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {StringDecoder} from 'node:string_decoder'
import {CoreError} from '../../shared/core.js'
import type {VoiceRequest,SpeechTimings} from '../../shared/voice.js'
import type {SpeechOutput,VoiceConfig} from './runtime.js'
type Input=Extract<VoiceRequest,{kind:'tts'}>
type Pending={input:Input;resolve:(value:SpeechOutput)=>void;reject:(error:Error)=>void;began:number;cold:boolean}
type Lease={owner:string;identity:string;id:string;child:ChildProcessWithoutNullStreams;ready:Promise<void>;readyResolve:()=>void;readyReject:(error:Error)=>void;exited:Promise<void>;exitResolve:()=>void;ended:boolean;prepared:boolean;claimed:boolean;stopping?:Promise<void>;pending?:Pending;timer?:ReturnType<typeof setTimeout>;loadTimer?:ReturnType<typeof setTimeout>;timings?:SpeechTimings;failure?:Error}
export class ReplySpeechSession{
 private lease:Lease|null=null
 private uncertain=false
 constructor(private parse:(output:string,code:number|null,input:VoiceRequest)=>SpeechOutput,private env:(config:VoiceConfig)=>NodeJS.ProcessEnv,private idleMs=60000){}
 owner(){return this.lease?.owner??null}
 held(){return !!this.lease&&!this.lease.ended}
 fault(){return this.uncertain}
 assertOwner(owner:string){if(this.uncertain)throw new CoreError('voice-stop-unverified');if(this.lease&&this.lease.owner!==owner)throw new CoreError('busy')}
 private open(owner:string,config:VoiceConfig){
  let readyResolve:()=>void=()=>{},readyReject:(error:Error)=>void=()=>{},exitResolve:()=>void=()=>{}
  const ready=new Promise<void>((yes,no)=>{readyResolve=yes;readyReject=no}),exited=new Promise<void>(yes=>exitResolve=yes);void ready.catch(()=>{})
  const child=spawn(config.python,[config.worker,config.tts],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:this.env(config)})
  const lease:Lease={owner,identity:JSON.stringify([config.python,config.workerHash,config.tts]),id:randomUUID(),child,ready,readyResolve,readyReject,exited,exitResolve,ended:false,prepared:false,claimed:false};this.lease=lease
  const decoder=new StringDecoder('utf8');let output='',stderrBytes=0
  const fail=(error:Error)=>{lease.failure??=error;void this.stop(owner).then(()=>{lease.readyReject(error);lease.pending?.reject(error)},e=>{lease.readyReject(e);lease.pending?.reject(e)})}
  lease.loadTimer=setTimeout(()=>fail(new CoreError('timeout')),90000);lease.loadTimer.unref()
  child.once('spawn',()=>child.stdin.write(JSON.stringify({kind:'init',leaseId:lease.id})+'\n'))
  child.stdout.on('data',(bytes:Buffer)=>{
   output+=decoder.write(bytes);if(Buffer.byteLength(output)>3000000){fail(new CoreError('voice-output-limit'));return}
   while(output.includes('\n')){
    const at=output.indexOf('\n'),line=output.slice(0,at);output=output.slice(at+1)
    try{
     const value=JSON.parse(line)
     if(!lease.prepared){
      if(value.version!==1||value.ready!==true||value.leaseId!==lease.id||!value.timings||Object.keys(value.timings).length!==4||Object.entries(value.timings).some(([key,n])=>!['importMs','modelLoadMs','decodeMs','inputWaitMs'].includes(key)||typeof n!=='number'||!Number.isFinite(n)||n<0||n>180000))throw new CoreError('protocol')
      lease.timings=value.timings;lease.prepared=true;if(lease.loadTimer)clearTimeout(lease.loadTimer);lease.readyResolve();continue
     }
     const pending=lease.pending;if(!pending||value.operationId!==pending.input.operationId)throw new CoreError('protocol')
     const result=this.parse(line,0,pending.input)
     const elapsedMs=Math.round(performance.now()-pending.began)
     result.timings={...result.timings,...(pending.cold?{importMs:lease.timings?.importMs,modelLoadMs:lease.timings?.modelLoadMs,decodeMs:(result.timings?.decodeMs??0)+(lease.timings?.decodeMs??0)}:{}),workerWallMs:elapsedMs}
     delete lease.pending;this.arm(lease);pending.resolve(result)
    }catch(error){fail(error instanceof CoreError?error:new CoreError('protocol'));return}
   }
  })
  child.stderr.on('data',(bytes:Buffer)=>{stderrBytes+=bytes.length;if(stderrBytes>16384)fail(new CoreError('voice-output-limit'))})
  child.stdin.on('error',()=>{/* Process close remains the authority. */})
  child.once('error',()=>fail(new CoreError('voice-runtime-unavailable')))
  child.once('close',()=>{lease.ended=true;if(lease.timer)clearTimeout(lease.timer);if(lease.loadTimer)clearTimeout(lease.loadTimer);lease.exitResolve();lease.readyReject(lease.failure??new CoreError('cancelled'));lease.pending?.reject(lease.failure??new CoreError('cancelled'));delete lease.pending;if(this.lease===lease)this.lease=null})
  return lease
 }
 private arm(lease:Lease){if(lease.timer)clearTimeout(lease.timer);lease.timer=setTimeout(()=>{void this.stop(lease.owner).catch(()=>{})},this.idleMs);lease.timer.unref()}
 async submit(owner:string,input:Input,signal:AbortSignal,config:VoiceConfig){
  this.assertOwner(owner);signal.throwIfAborted();if(this.lease?.claimed)throw new CoreError('busy')
  const identity=JSON.stringify([config.python,config.workerHash,config.tts]);if(this.lease&&this.lease.identity!==identity)await this.stop(owner)
  const cold=!this.lease,lease=this.lease??this.open(owner,config),began=performance.now();lease.claimed=true;if(lease.timer)clearTimeout(lease.timer)
  const abort=()=>{void this.stop(owner).catch(()=>{})};signal.addEventListener('abort',abort,{once:true})
  try{
   await lease.ready;signal.throwIfAborted();if(lease.ended||lease.stopping)throw new CoreError('cancelled')
   return await new Promise<SpeechOutput>((resolve,reject)=>{lease.pending={input,resolve,reject,began,cold};lease.child.stdin.write(JSON.stringify({kind:'tts',operationId:input.operationId,text:input.text})+'\n')})
  }finally{lease.claimed=false;signal.removeEventListener('abort',abort)}
 }
 async stop(owner:string){
  const lease=this.lease;if(!lease||lease.owner!==owner||lease.ended)return
  if(lease.stopping)return lease.stopping
  lease.stopping=(async()=>{if(lease.timer)clearTimeout(lease.timer);lease.child.kill();let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([lease.exited,new Promise<void>((_,reject)=>{timer=setTimeout(()=>{this.uncertain=true;const error=new CoreError('voice-stop-unverified');lease.failure=error;lease.readyReject(error);lease.pending?.reject(error);reject(error)},5000);timer.unref()})])}finally{if(timer)clearTimeout(timer)}})()
  return lease.stopping
 }
 async close(){if(this.lease)await this.stop(this.lease.owner)}
}
