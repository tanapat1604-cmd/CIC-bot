import {test,expect,type Page} from '@playwright/test'
import {once} from 'node:events'
import {createVoiceCore} from '../backend/voice/core'
import {createScheduler} from '../backend/core/scheduler'
import {createChromeResearchCore} from '../backend/chrome/core'
import {CoreError} from '../shared/core'
import {createChatServer} from '../backend/server'
async function fixture(page:Page,baseURL:string,recognition: string[],assistantThink: NonNullable<Parameters<typeof createChatServer>[0]>['assistantThink']=async()=>({tool:'ask',argument:'กรุณาบอกความหมายให้ชัดครับ'}),onPrepare?:()=>Promise<void>){
 const scheduler=createScheduler({freeMiB:()=>2048,externalBusy:()=>false});let calls=0,index=0;const inputs:unknown[]=[],speech:unknown[]=[];let asrCalls=0,ttsCalls=0
 const chrome=createChromeResearchCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>2048,propose:async()=>{throw new CoreError('unsupported')},select:async()=>undefined,start:async()=>{throw Error('No native Chrome in voice lifecycle fixtures')}})
 const voice=createVoiceCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>2048,runner:async v=>{calls++;if(v.kind==='asr')asrCalls++;else{ttsCalls++;speech.push('text'in v?{kind:'tts',text:v.text}:{kind:'tts',phrase:v.phrase})}if(v.kind==='tts'&&v.text==='พร้อมฟังครับ'&&onPrepare)await onPrepare();return v.kind==='asr'?{kind:'asr',text:recognition[Math.min(index++,recognition.length-1)],elapsedMs:1,peakWorkingSetMiB:32}:{kind:'tts',...('text'in v?{text:v.text}:{phrase:v.phrase}),wav:Buffer.alloc(60),elapsedMs:1,peakWorkingSetMiB:32}}}),server=createChatServer({voice,chrome,assistantThink:async(input,signal)=>{inputs.push(input);return assistantThink!(input,signal)},provider:{kind:'live' as const,model:'fixture-no-LLM',async *stream(){throw Error('Utilities must not call the model');yield ''}},origins:[new URL(baseURL).origin]});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port
 await page.route('http://127.0.0.1:8787/**',async route=>{await route.fulfill({response:await route.fetch({url:route.request().url().replace('http://127.0.0.1:8787',base)})})})
 await page.addInitScript(()=>{
  type State={cues:number;calls:number;stopped:boolean;samples:number;pending:boolean;resolve?:()=>void;plays:number;lastDeviceId:string;silent:boolean;endPlayback?:()=>void}
  const w=window as typeof window&{voiceFixture:State},state:State={cues:0,calls:0,stopped:true,samples:0,pending:false,plays:0,lastDeviceId:'',silent:false};w.voiceFixture=state
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(options:{audio:{deviceId?:{exact:string}}})=>{state.calls++;state.lastDeviceId=options.audio.deviceId?.exact??'default';const get=()=>{state.stopped=false;return{getTracks:()=>[{stop:()=>state.stopped=true}]}};if(state.pending)return new Promise(resolve=>state.resolve=()=>resolve(get()));return get()}})
  Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{value:async()=>[{deviceId:'headset-fixture',kind:'audioinput',label:'ไมค์หูฟังทดสอบ'}]})
  class FakeContext{sampleRate=16000;timer?:ReturnType<typeof setInterval>;resume(){return Promise.resolve()}close(){if(this.timer)clearInterval(this.timer);return Promise.resolve()}createMediaStreamSource(){return{connect:()=>{},disconnect:()=>{}}}createOscillator(){state.cues++;return{frequency:{value:0},onended:null,connect:()=>{},disconnect:()=>{},start:()=>{},stop:()=>{}}}createGain(){return{gain:{value:0,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},connect:()=>{},disconnect:()=>{}}}createScriptProcessor(){const processor={onaudioprocess:null as ((e:{inputBuffer:{getChannelData:()=>Float32Array}})=>void)|null,connect:()=>{},disconnect:()=>{}};this.timer=setInterval(()=>{if(processor.onaudioprocess){const frame=new Float32Array(4096);if(!state.silent)for(let i=0;i<frame.length;i++)frame[i]=Math.sin(i/10)*0.2;state.samples+=frame.length;processor.onaudioprocess({inputBuffer:{getChannelData:()=>frame}})}},100);return processor}}
  Object.defineProperty(window,'AudioContext',{value:FakeContext});Object.defineProperty(window,'Audio',{value:class{src='';onended:()=>void=()=>{};play(){state.plays++;state.endPlayback=()=>this.onended();return Promise.resolve()}pause(){}}})
 })
 return{backendBase:base,calls:()=>calls,asrCalls:()=>asrCalls,ttsCalls:()=>ttsCalls,inputs,speech,async close(){await page.unrouteAll({behavior:'wait'});server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await voice.close();await chrome.close();scheduler.close()}}
}
const state=(page:Page)=>page.evaluate(()=>(window as typeof window&{voiceFixture:{calls:number;stopped:boolean;samples:number;pending:boolean;resolve?:()=>void;plays:number;lastDeviceId:string}}).voiceFixture)
const micTurn=async(page:Page,f:Awaited<ReturnType<typeof fixture>>,number:number)=>{
 await page.getByRole('button',{name:/^(เริ่มคุย|คุยต่อ)$/}).click();
 await expect(page.getByRole('status')).toContainText('ฟังอยู่');
 await expect.poll(async()=>(await state(page)).samples).toBeGreaterThan(8192*number);
 await page.getByRole('button',{name:'พูดจบแล้ว',exact:true}).click();
 await expect.poll(()=>f.asrCalls()).toBe(number);
};
test('full reply UI: microphone answer is spoken verbatim; no ack and no rearm until playback ends',async({page,baseURL})=>{
 const reply='แบ่งงานเป็นส่วนเล็ก แล้วเริ่มจากส่วนที่สำคัญที่สุดครับ',f=await fixture(page,baseURL!,['ช่วยอธิบายวิธีเริ่มทำงาน'],async()=>({tool:'answer',argument:reply}));
 try{await page.goto('./?voiceReply=1#/cic');expect((await state(page)).calls).toBe(0);await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText(reply);await expect.poll(()=>f.ttsCalls()).toBe(1);expect(f.speech).toEqual([{kind:'tts',text:reply}]);await expect.poll(async()=>(await state(page)).plays).toBe(1);expect((await state(page)).calls).toBe(1);expect((await state(page)).stopped).toBe(true)
  await page.evaluate(()=>(window as typeof window&{voiceFixture:{endPlayback:()=>void}}).voiceFixture.endPlayback());await expect.poll(async()=>(await state(page)).calls).toBe(2);await expect(page.getByRole('status')).toContainText('ฟังอยู่')
  await page.getByRole('button',{name:'หยุด',exact:true}).click();await expect(page.getByRole('status')).toContainText('ยุติแล้ว');expect((await state(page)).stopped).toBe(true)
 }finally{await f.close()}
});
test('full reply UI: a missing-slot question is spoken, then literal answer uses calculator and speaks its result',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['คำนวณ','16+9']);
 try{await page.goto('./?voiceReply=1#/cic');await micTurn(page,f,1);await expect.poll(()=>f.ttsCalls()).toBe(1);expect(f.speech[0]).toEqual({kind:'tts',text:'ต้องการคำนวณสมการอะไรครับ? เช่น (73-19)*2'});await expect.poll(async()=>(await state(page)).plays).toBe(1)
  await micTurn(page,f,2);await expect(page.getByRole('log')).toContainText('16+9 = 25');await expect.poll(()=>f.ttsCalls()).toBe(2);expect(f.speech[1]).toEqual({kind:'tts',text:'16+9 = 25'});expect(f.inputs).toHaveLength(0);expect((await state(page)).stopped).toBe(true);await page.getByRole('button',{name:'หยุด',exact:true}).click();await expect(page.getByRole('status')).toContainText('ยุติแล้ว')
 }finally{await f.close()}
});
test('full reply UI: typed replies do not open microphone or play speech',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['unused']);
 try{await page.goto('./?voiceReply=1#/cic');await page.getByRole('textbox',{name:'ข้อความถึง CiC'}).fill('คำนวณ 19*3');await page.getByRole('button',{name:'ส่ง',exact:true}).click();await expect(page.getByRole('log')).toContainText('19*3 = 57');expect((await state(page)).calls).toBe(0);expect((await state(page)).plays).toBe(0);expect(f.ttsCalls()).toBe(0)}finally{await f.close()}
});

test('default main keeps full speech trial off, with no synthesized answer or automatic mic rearm',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['ช่วยอธิบายการแบ่งงาน'],async()=>({tool:'answer',argument:'แบ่งงานเป็นส่วนเล็กครับ'}));
 try{await page.goto('./#/cic');await expect(page.getByRole('checkbox',{name:'อ่านคำตอบเต็ม (ทดลอง)',exact:true})).not.toBeChecked();await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('แบ่งงานเป็นส่วนเล็กครับ');expect(f.ttsCalls()).toBe(0);expect((await state(page)).plays).toBe(0);expect((await state(page)).stopped).toBe(true)}finally{await f.close()}
});
test('warm reply prepares only after a user gesture and never plays preparation or opens mic while it is pending',async({page,baseURL})=>{
 let release:()=>void=()=>{};const f=await fixture(page,baseURL!,['unused'],undefined,()=>new Promise<void>(r=>release=r));
 try{
  await page.route('http://127.0.0.1:8787/voice/status',async route=>{const r=await route.fetch({url:f.backendBase+'/voice/status'}),data=await r.json();await route.fulfill({json:{...data,replySpeechWarmConfigured:true,replySpeechSessionOwned:f.ttsCalls()>0,replySpeechSessionHeld:f.ttsCalls()>0}})})
  await page.goto('./?voiceReply=1#/cic');expect(f.ttsCalls()).toBe(0);expect((await state(page)).calls).toBe(0);await page.getByRole('button',{name:'เริ่มคุย',exact:true}).click();await expect.poll(()=>f.ttsCalls()).toBe(1);await expect(page.getByRole('status')).toContainText('กำลังเตรียม');expect((await state(page)).calls).toBe(0);expect((await state(page)).plays).toBe(0);release();await expect(page.getByRole('status')).toContainText('ฟังอยู่');expect((await state(page)).calls).toBe(1);expect((await state(page)).plays).toBe(0);await page.getByRole('button',{name:'หยุด',exact:true}).click();await expect(page.getByRole('status')).toContainText('ยุติแล้ว')
 }finally{release();await f.close()}
});
test('a foreign warm speech lease blocks capture before a microphone can open',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['unused']);
 try{await page.route('http://127.0.0.1:8787/voice/status',async route=>{const r=await route.fetch({url:f.backendBase+'/voice/status'}),data=await r.json();await route.fulfill({json:{...data,replySpeechWarmConfigured:true,replySpeechSessionOwned:false,replySpeechSessionHeld:true}})});await page.goto('./?voiceReply=1#/cic');await page.getByRole('button',{name:'เริ่มคุย',exact:true}).click();await expect(page.getByRole('status')).toContainText('มีงานอื่น');expect((await state(page)).calls).toBe(0);expect(f.ttsCalls()).toBe(0)}finally{await f.close()}
});
