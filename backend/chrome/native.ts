import {spawn} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {resolve} from 'node:path'
import {createInterface} from 'node:readline'
import {CoreError} from '../../shared/core.js'
import {parseChromeObservation,type ChromeObservation} from '../../shared/chromeObservation.js'
export type ChromeReader={alive:()=>boolean;observe:()=>Promise<ChromeObservation>;close:()=>Promise<void>}
export async function startChromeReader(query:string,signal:AbortSignal):Promise<ChromeReader>{
 signal.throwIfAborted()
 if(process.platform!=='win32')throw new CoreError('unsupported-os')
 const file=resolve('.tools/native-chrome-reader/CicChromeReader.exe'),pin=(await readFile(resolve('.tools/native-chrome-reader/CicChromeReader.sha256'),'utf8')).trim()
 if(!/^[a-f0-9]{64}$/u.test(pin)||createHash('sha256').update(await readFile(file)).digest('hex')!==pin)throw new CoreError('helper-integrity')
 signal.throwIfAborted();const nonce=randomUUID(),child=spawn(file,[],{windowsHide:true,stdio:'pipe'}),pending=new Map<string,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();let dead=false,closed=false,bytes=0
 const exit=new Promise<void>(done=>{const finish=()=>{if(dead)return;dead=true;clearInterval(heartbeat);child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new CoreError('helper-exited'))}pending.clear();done()};child.once('close',finish);child.once('error',()=>{if(!child.pid)finish()})})
 child.stdin.on('error',()=>{});child.stderr.resume();child.stdout.on('data',b=>{bytes+=b.length;if(bytes>120000)void close()})
 createInterface({input:child.stdout}).on('line',line=>{bytes=0;if(line.length>60000){void close();return}try{const r=JSON.parse(line),p=pending.get(r.id);if(!p)return;pending.delete(r.id);clearTimeout(p.timer);if(r.error)p.reject(new CoreError(String(r.error).slice(0,80)));else p.resolve(r.value)}catch{void close()}})
 const heartbeat=setInterval(()=>{if(!closed&&!dead)child.stdin.write(JSON.stringify({nonce,command:'heartbeat'})+'\n')},250);heartbeat.unref()
 async function close(){if(!closed){closed=true;clearInterval(heartbeat);child.stdin.end();child.kill()}const settled=await Promise.race([exit.then(()=>true),new Promise<boolean>(r=>{const timer=setTimeout(()=>r(false),5000);timer.unref()})]);if(!settled)throw new CoreError('chrome-reader-stop-unverified')}
 const request=(command:string,args:Record<string,unknown>={}):Promise<unknown>=>{if(dead||closed)return Promise.reject(new CoreError('helper-exited'));return new Promise((resolve,reject)=>{const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(new CoreError('helper-timeout'));void close()},12000);timer.unref();pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({nonce,id,command,...args})+'\n')})}
 const parse=(v:unknown)=>{const result=parseChromeObservation(v);if(result.instanceId!==nonce||result.query!==query)throw new CoreError('protocol');return result}
 const abort=()=>{void close().catch(()=>{})};signal.addEventListener('abort',abort,{once:true})
 let initial:ChromeObservation|null=null,initialAt=0
 try{try{initial=parse(await request('init',{query}));initialAt=performance.now()}catch(e){if(!(e instanceof CoreError&&e.code==='document-not-ready'))throw e}signal.throwIfAborted()}catch(e){await close();throw e}finally{signal.removeEventListener('abort',abort)}
 return{alive:()=>!dead&&!closed,observe:async()=>{if(dead||closed)throw new CoreError('helper-exited');if(initial&&performance.now()-initialAt<500){const first=initial;initial=null;return first}initial=null;return parse(await request('observe'))},close}
}
