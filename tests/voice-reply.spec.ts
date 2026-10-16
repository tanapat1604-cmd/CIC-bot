import {test,expect} from '@playwright/test'
import {once} from 'node:events'
import {randomUUID} from 'node:crypto'
import {parseVoiceRequest,parseVoiceJob} from '../shared/voice'
import {createVoiceCore} from '../backend/voice/core'
import {createScheduler} from '../backend/core/scheduler'
import {createChatServer} from '../backend/server'
const request=(text:string)=>({version:1,operationId:randomUUID(),acknowledged:true,kind:'tts',text})
test('reply dev: actual Thai/English full text is accepted without a fixed phrase',()=>{
 for(const text of ['ต้องการคำนวณสมการอะไรครับ?','16 + 9 = 25','The answer is twenty five.']){
  const input=request(text);expect(parseVoiceRequest(input)).toEqual(input)
  expect(parseVoiceJob({version:1,taskId:randomUUID(),operationId:input.operationId,kind:'tts',state:'succeeded',result:{text,audioBytes:44,elapsedMs:1,peakWorkingSetMiB:null}}).result?.text).toBe(text)
 }
});
test('reply held: controls, whitespace-only, oversized text, mixed phrase/text or hidden permissions are rejected',()=>{
 for(const value of [request(''),request('   '),request(' hello'),request('x'.repeat(601)),request('hello\nthere'),request('hello\u0000'),{...request('hello'),phrase:'ack'},{...request('hello'),granted:true}])expect(()=>parseVoiceRequest(value)).toThrow()
 expect(()=>parseVoiceJob({version:1,taskId:randomUUID(),operationId:randomUUID(),kind:'tts',state:'succeeded',result:{text:'full answer',phrase:'ack',audioBytes:44,elapsedMs:1,peakWorkingSetMiB:null}})).toThrow('protocol')
});
test('reply dev: backend ownership, nonce and Stop settlement apply to the whole reply, not just a phrase',async()=>{
 const scheduler=createScheduler({freeMiB:()=>4096,externalBusy:()=>false});let started=false,aborted=false,exited=false,release:()=>void=()=>{};
 const voice=createVoiceCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>4096,runner:async(input,signal)=>{started=true;signal.addEventListener('abort',()=>aborted=true);await new Promise<void>(r=>release=r);exited=true;return{kind:'tts',text:'text'in input?input.text:undefined,wav:Buffer.alloc(60),elapsedMs:1,peakWorkingSetMiB:32}}});
 const server=createChatServer({voice});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:5173';
 const session=async()=>{const r=await fetch(base+'/session',{method:'POST',headers:{Origin}});return{Origin,Cookie:r.headers.get('set-cookie')!.split(';')[0],'Content-Type':'application/json'}};
 const owner=await session(),other=await session(),input=request('คำตอบเต็มที่หยุดได้');
 const post=(path:string,body:unknown,headers=owner)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
 try{
  const created=await post('/voice/jobs',input);expect(created.status).toBe(201);const job=parseVoiceJob(await created.json());await expect.poll(()=>started).toBe(true)
  expect((await fetch(base+'/voice/jobs/'+job.taskId,{headers:other})).status).toBe(404);await post('/voice/stop',{},other);expect(aborted).toBe(false)
  expect((await post('/voice/jobs',input)).status).not.toBe(201)
  let settled=false;const stop=post('/voice/stop',{}).then(async r=>{const data=await r.json();settled=data.settled===true;return data});await expect.poll(()=>aborted).toBe(true);expect(exited).toBe(false);expect(settled).toBe(false);release();expect((await stop).settled).toBe(true);expect(exited).toBe(true)
  expect(parseVoiceJob(await(await fetch(base+'/voice/jobs/'+job.taskId,{headers:owner})).json()).state).toBe('cancelled');expect((await fetch(base+'/voice/jobs/'+job.taskId+'/audio',{headers:owner})).status).toBe(404)
 }finally{release();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await voice.close();scheduler.close()}
});
