import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {resolve} from 'node:path'
import {createInterface} from 'node:readline'
import {CoreError} from '../../shared/core.js'
import {parseLabObservation,type LabAction,type LabObservation} from '../../shared/lab.js'
export type LabNative={pid?:number;observe:()=>Promise<LabObservation>;execute:(action:LabAction,text:string,geometry:string,signal:AbortSignal,grant:{taskId:string;operationId:string;grantId:string;observationId:string;deadlineMs:number})=>Promise<{before:LabObservation;after:LabObservation}>;close:()=>Promise<void>;alive:()=>boolean}
export async function startNativeLab():Promise<LabNative>{
 if(process.platform!=='win32')throw new CoreError('unsupported-os')
 const file=resolve('.tools/native-lab/CicLab.exe'),pin=resolve('.tools/native-lab/CicLab.sha256')
 const hash=(await readFile(pin,'utf8')).trim();if(!/^[a-f0-9]{64}$/.test(hash)||createHash('sha256').update(await readFile(file)).digest('hex')!==hash)throw new CoreError('helper-integrity')
 const nonce=randomUUID(),child:ChildProcessWithoutNullStreams=spawn(file,[],{stdio:'pipe',windowsHide:true}),pending=new Map<string,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();let exited=false,bufferBytes=0,closed=false
 const exitedPromise=new Promise<void>(done=>{child.once('exit',()=>{exited=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(new CoreError('helper-exited'))}pending.clear();done()});child.once('error',()=>{exited=true;for(const p of pending.values())p.reject(new CoreError('helper-start'));pending.clear();done()})})
 child.stderr.resume();child.stdin.on('error',()=>{});child.stdout.on('data',b=>{bufferBytes+=b.length;if(bufferBytes>1048576)void close()})
 const lines=createInterface({input:child.stdout});lines.on('line',line=>{bufferBytes=0;if(line.length>16384){void close();return}try{const v=JSON.parse(line);const p=pending.get(v.id);if(!p)return;pending.delete(v.id);clearTimeout(p.timer);if(v.error)p.reject(new CoreError(String(v.error).slice(0,80)));else p.resolve(v.value)}catch{void close()}})
 async function close(){if(!closed){closed=true;clearInterval(heartbeat);try{child.stdin.end();child.kill()}catch{/* EOF/watchdog still must exit before acknowledgement. */}}await exitedPromise}
 const heartbeat=setInterval(()=>{if(!closed&&!exited)child.stdin.write(JSON.stringify({nonce,command:'heartbeat'})+'\n')},250);heartbeat.unref()
 function request(command:string,args:Record<string,unknown>={},timeout=35000):Promise<unknown>{if(closed||exited)return Promise.reject(new CoreError('helper-exited'));const id=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new CoreError('helper-timeout'));void close()},timeout);timer.unref();pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({nonce,id,command,...args})+'\n')})}
 const observation=(v:unknown):LabObservation=>{const o=parseLabObservation(v);if(o.instanceId!==nonce)throw new CoreError('helper-protocol');return o}
 try{await request('init',{},10000)}catch(e){await close();throw e}
 return {pid:child.pid,alive:()=>!closed&&!exited,close,observe:async()=>observation(await request('observe',{},3000)),execute:async(action,text,geometry,signal,grant)=>{
  signal.throwIfAborted();const cancel=()=>{void close()};signal.addEventListener('abort',cancel,{once:true})
  try{const v=await request('execute',{action,text,geometry,...grant,permission:'lab.control',policyVersion:1,sessionId:nonce}) as {before:unknown;after:unknown};signal.throwIfAborted();return{before:observation(v.before),after:observation(v.after)}}finally{signal.removeEventListener('abort',cancel)}
 }}
}
