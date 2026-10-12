import {spawn} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {resolve} from 'node:path'
import {createInterface} from 'node:readline'
import {CoreError} from '../../shared/core.js'
import {parseNotepadObservation,type NotepadObservation} from '../../shared/notepad.js'
export type NotepadNative={alive:()=>boolean;observe:()=>Promise<NotepadObservation>;execute:(text:string,before:NotepadObservation,grant:{taskId:string;operationId:string;grantId:string;deadlineMs:number},signal:AbortSignal)=>Promise<{before:NotepadObservation;after:NotepadObservation}>;close:()=>Promise<void>}
export async function startNotepad():Promise<NotepadNative>{
 if(process.platform!=='win32')throw new CoreError('unsupported-os')
 const file=resolve('.tools/native-notepad/CicNotepad.exe'),pin=resolve('.tools/native-notepad/CicNotepad.sha256'),hash=(await readFile(pin,'utf8')).trim();if(!/^[a-f0-9]{64}$/.test(hash)||createHash('sha256').update(await readFile(file)).digest('hex')!==hash)throw new CoreError('helper-integrity')
 const nonce=randomUUID(),child=spawn(file,[],{stdio:'pipe',windowsHide:true}),pending=new Map<string,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();let dead=false,closed=false,bytes=0
 const exit=new Promise<void>(done=>{const finish=()=>{dead=true;clearInterval(heartbeat);child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new CoreError('helper-exited'))}pending.clear();done()};child.once('exit',finish);child.once('error',finish)})
 child.stderr.resume();child.stdin.on('error',()=>{});child.stdout.on('data',b=>{bytes+=b.length;if(bytes>1048576)void close()})
 createInterface({input:child.stdout}).on('line',line=>{bytes=0;if(line.length>16384){void close();return}try{const v=JSON.parse(line),p=pending.get(v.id);if(!p)return;pending.delete(v.id);clearTimeout(p.timer);if(v.error)p.reject(new CoreError(String(v.error).slice(0,80)));else p.resolve(v.value)}catch{void close()}})
 const heartbeat=setInterval(()=>{if(!closed&&!dead)child.stdin.write(JSON.stringify({nonce,command:'heartbeat'})+'\n')},250);heartbeat.unref()
 async function close(){if(!closed){closed=true;clearInterval(heartbeat);child.stdin.end();try{child.kill()}catch{/* Wait for EOF/watchdog/owned process exit. */}}await exit}
 const request=(command:string,args:Record<string,unknown>={},timeout=5000):Promise<unknown>=>{if(closed||dead)return Promise.reject(new CoreError('helper-exited'));const id=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new CoreError('helper-timeout'));void close()},timeout);timer.unref();pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({nonce,id,command,...args})+'\n')})}
 const observation=(v:unknown)=>{const o=parseNotepadObservation(v);if(o.instanceId!==nonce)throw new CoreError('protocol');return o}
 try{observation(await request('init',{},12000))}catch(e){await close();throw e}
 return{alive:()=>!closed&&!dead,close,observe:async()=>observation(await request('observe')),execute:async(text,before,grant,signal)=>{signal.throwIfAborted();const cancel=()=>{void close()};signal.addEventListener('abort',cancel,{once:true});try{const v=await request('execute',{text,geometry:before.geometry,observationId:before.observationId,expectedText:before.text,permission:'notepad.append',policyVersion:1,...grant},10000) as {before:unknown;after:unknown};signal.throwIfAborted();return{before:observation(v.before),after:observation(v.after)}}finally{signal.removeEventListener('abort',cancel)}}}
}
