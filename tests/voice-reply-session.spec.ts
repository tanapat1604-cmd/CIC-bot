import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {CoreError} from '../shared/core'
import {ReplySpeechSession} from '../backend/voice/replySession'
import type {VoiceRequest} from '../shared/voice'
const input=(text:string):Extract<VoiceRequest,{kind:'tts'}>=>({version:1,operationId:crypto.randomUUID(),acknowledged:true,kind:'tts',text})
async function fixture(options:{initDelay?:number;replyDelay?:number;wrongOp?:boolean;idleMs?:number}={}){
 const dir=await fs.mkdtemp(path.join(process.cwd(),'.reply-session-fixture-')),file=path.join(dir,'worker.mjs'),pidFile=path.join(dir,'pid');
 const code=`import fs from 'node:fs';import readline from 'node:readline';const read=readline.createInterface({input:process.stdin});read.on('line',line=>{const r=JSON.parse(line);if(r.kind==='init'){fs.writeFileSync(process.argv[2],String(process.pid));setTimeout(()=>console.log(JSON.stringify({version:1,ready:true,leaseId:r.leaseId,timings:{importMs:0,modelLoadMs:0,decodeMs:0,inputWaitMs:0}})),${options.initDelay??0});return;}setTimeout(()=>console.log(JSON.stringify({version:1,ok:true,kind:'tts',operationId:${options.wrongOp?"'wrong-operation'":'r.operationId'},text:r.text,wav:Buffer.alloc(44).toString('base64'),elapsedMs:1,peakWorkingSetMiB:0,timings:{importMs:0,modelLoadMs:0,decodeMs:0,inputWaitMs:0}})),${options.replyDelay??0})});`;
 await fs.writeFile(file,code)
 const session=new ReplySpeechSession((line,_code,request)=>{const r=JSON.parse(line);if(!r.ok||request.kind!=='tts'||r.text!==request.text)throw new CoreError('protocol');return{kind:'tts',text:r.text,wav:Buffer.from(r.wav,'base64'),elapsedMs:r.elapsedMs,peakWorkingSetMiB:r.peakWorkingSetMiB,timings:r.timings}},()=>({...process.env}),options.idleMs??60000)
 const config={python:process.execPath,worker:file,workerHash:'fixture-hash',tts:pidFile,asr:pidFile,files:[]}
 const pid=async()=>Number(await fs.readFile(pidFile,'utf8'))
 return{session,config,pid,async close(){await session.close();await fs.unlink(file);await fs.unlink(pidFile).catch(()=>{});await fs.rmdir(dir)}}
}
const gone=(pid:number)=>{try{process.kill(pid,0);return false}catch(e){return(e as NodeJS.ErrnoException).code==='ESRCH'}}
test('warm dev: different replies share one owned child; foreign owner cannot reuse or stop it',async()=>{
 const f=await fixture()
 try{const first=await f.session.submit('owner',input('คำตอบแรก'),new AbortController().signal,f.config),pid=await f.pid();expect(first.text).toBe('คำตอบแรก');expect(f.session.held()).toBe(true);expect(f.session.owner()).toBe('owner');await expect(f.session.submit('other',input('ห้ามข้ามเจ้าของ'),new AbortController().signal,f.config)).rejects.toThrow('busy');await f.session.stop('other');expect(gone(pid)).toBe(false);expect((await f.session.submit('owner',input('คำตอบใหม่'),new AbortController().signal,f.config)).text).toBe('คำตอบใหม่');expect(await f.pid()).toBe(pid);await f.session.stop('owner');expect(gone(pid)).toBe(true);expect(f.session.held()).toBe(false)}finally{await f.close()}
});
test('warm dev: preparing and active synthesis still permit only one request; abort waits for actual owned process exit',async()=>{
 const f=await fixture({initDelay:400,replyDelay:400}),controller=new AbortController()
 try{const task=f.session.submit('owner',input('คำตอบที่ต้องยกเลิก'),controller.signal,f.config),rejected=expect(task).rejects.toThrow('cancelled');await expect.poll(()=>f.pid().catch(()=>0)).toBeGreaterThan(0);await expect(f.session.submit('owner',input('งานซ้อน'),new AbortController().signal,f.config)).rejects.toThrow('busy');const pid=await f.pid();controller.abort();await rejected;expect(gone(pid)).toBe(true);expect(f.session.held()).toBe(false)}finally{controller.abort();await f.close()}
});
test('warm held: idle expiry releases actual child without a new request',async()=>{
 const f=await fixture({idleMs:80})
 try{await f.session.submit('owner',input('ข้อความที่ไม่เก็บเป็นไฟล์'),new AbortController().signal,f.config);const pid=await f.pid();await expect.poll(()=>f.session.held()).toBe(false);expect(gone(pid)).toBe(true);expect(f.session.fault()).toBe(false)}finally{await f.close()}
});
test('warm held: a mismatched operation reply cannot be delivered and stops the owned child first',async()=>{
 const f=await fixture({wrongOp:true})
 try{await expect(f.session.submit('owner',input('ห้ามส่งผลของรอบอื่น'),new AbortController().signal,f.config)).rejects.toThrow('protocol');expect(gone(await f.pid())).toBe(true);expect(f.session.held()).toBe(false)}finally{await f.close()}
});
