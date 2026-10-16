import {test,expect,type Page} from '@playwright/test'
import {once} from 'node:events'
import {createVoiceCore} from '../backend/voice/core'
import {createScheduler} from '../backend/core/scheduler'
import {createChromeResearchCore} from '../backend/chrome/core'
import {CoreError} from '../shared/core'
import {createChatServer} from '../backend/server'
async function fixture(page:Page,baseURL:string,recognition: string[],assistantThink: NonNullable<Parameters<typeof createChatServer>[0]>['assistantThink']=async()=>({tool:'ask',argument:'กรุณาบอกความหมายให้ชัดครับ'})){
 const scheduler=createScheduler({freeMiB:()=>2048,externalBusy:()=>false});let calls=0,index=0;const inputs:unknown[]=[];let asrCalls=0,ttsCalls=0
 const chrome=createChromeResearchCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>2048,propose:async()=>{throw new CoreError('unsupported')},select:async()=>undefined,start:async()=>{throw Error('No native Chrome in voice lifecycle fixtures')}})
 const voice=createVoiceCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>2048,runner:async v=>{calls++;if(v.kind==='asr')asrCalls++;else ttsCalls++;return v.kind==='asr'?{kind:'asr',text:recognition[Math.min(index++,recognition.length-1)],elapsedMs:1,peakWorkingSetMiB:32}:{kind:'tts',phrase:v.phrase,wav:Buffer.alloc(60),elapsedMs:1,peakWorkingSetMiB:32}}}),server=createChatServer({voice,chrome,assistantThink:async(input,signal)=>{inputs.push(input);return assistantThink!(input,signal)},provider:{kind:'live' as const,model:'fixture-no-LLM',async *stream(){throw Error('Utilities must not call the model');yield ''}},origins:[new URL(baseURL).origin]});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port
 await page.route('http://127.0.0.1:8787/**',async route=>{await route.fulfill({response:await route.fetch({url:route.request().url().replace('http://127.0.0.1:8787',base)})})})
 await page.addInitScript(()=>{
  type State={cues:number;calls:number;stopped:boolean;samples:number;pending:boolean;resolve?:()=>void;plays:number;lastDeviceId:string;silent:boolean;endPlayback?:()=>void}
  const w=window as typeof window&{voiceFixture:State},state:State={cues:0,calls:0,stopped:true,samples:0,pending:false,plays:0,lastDeviceId:'',silent:false};w.voiceFixture=state
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(options:{audio:{deviceId?:{exact:string}}})=>{state.calls++;state.lastDeviceId=options.audio.deviceId?.exact??'default';const get=()=>{state.stopped=false;return{getTracks:()=>[{stop:()=>state.stopped=true}]}};if(state.pending)return new Promise(resolve=>state.resolve=()=>resolve(get()));return get()}})
  Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{value:async()=>[{deviceId:'headset-fixture',kind:'audioinput',label:'ไมค์หูฟังทดสอบ'}]})
  class FakeContext{sampleRate=16000;timer?:ReturnType<typeof setInterval>;resume(){return Promise.resolve()}close(){if(this.timer)clearInterval(this.timer);return Promise.resolve()}createMediaStreamSource(){return{connect:()=>{},disconnect:()=>{}}}createOscillator(){state.cues++;return{frequency:{value:0},onended:null,connect:()=>{},disconnect:()=>{},start:()=>{},stop:()=>{}}}createGain(){return{gain:{value:0,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},connect:()=>{},disconnect:()=>{}}}createScriptProcessor(){const processor={onaudioprocess:null as ((e:{inputBuffer:{getChannelData:()=>Float32Array}})=>void)|null,connect:()=>{},disconnect:()=>{}};this.timer=setInterval(()=>{if(processor.onaudioprocess){const frame=new Float32Array(4096);if(!state.silent)for(let i=0;i<frame.length;i++)frame[i]=Math.sin(i/10)*0.2;state.samples+=frame.length;processor.onaudioprocess({inputBuffer:{getChannelData:()=>frame}})}},100);return processor}}
  Object.defineProperty(window,'AudioContext',{value:FakeContext});Object.defineProperty(window,'Audio',{value:class{src='';onended:()=>void=()=>{};play(){state.plays++;state.endPlayback=()=>this.onended();return Promise.resolve()}pause(){}}})
 })
 return{backendBase:base,calls:()=>calls,asrCalls:()=>asrCalls,ttsCalls:()=>ttsCalls,inputs,async close(){await page.unrouteAll({behavior:'wait'});server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await voice.close();await chrome.close();scheduler.close()}}
}
const state=(page:Page)=>page.evaluate(()=>(window as typeof window&{voiceFixture:{calls:number;stopped:boolean;samples:number;pending:boolean;resolve?:()=>void;plays:number;lastDeviceId:string}}).voiceFixture)
const micTurn=async(page:Page,f:Awaited<ReturnType<typeof fixture>>,number:number)=>{
 const sampledBefore=(await state(page)).samples;
 await page.getByRole('button',{name:/^(เริ่มคุย|คุยต่อ)$/}).click();
 await expect(page.getByRole('status')).toContainText('ฟังอยู่');
 // Require fresh audio in this turn; samples from an earlier turn are not speech.
 await expect.poll(async()=>(await state(page)).samples-sampledBefore).toBeGreaterThan(8192);
 await page.getByRole('button',{name:'พูดจบแล้ว',exact:true}).click();
 await expect.poll(()=>f.asrCalls()).toBe(number);
};
const evidenceRows=async(page:Page)=>{
 await page.getByText('ตรวจเสียงรอบคุย',{exact:true}).click();
 return JSON.parse(await page.getByLabel('ข้อมูลรอบคุย',{exact:true}).innerText()) as {source:string;rawText:string;reply?:string;asr?:unknown;assistant?:unknown;utility?:{source:string}}[];
};
test('dev: microphone missing expression then payload uses actual calculator and retains both raw turns',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['คำนวณ','(8+7)*3']);
 try{await page.goto('./#/cic');expect((await state(page)).calls).toBe(0);
  await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('ต้องการคำนวณสมการอะไร');
  await micTurn(page,f,2);await expect(page.getByRole('log')).toContainText('(8+7)*3 = 45');
  expect(f.inputs).toHaveLength(0);expect(f.ttsCalls()).toBe(0);expect((await state(page)).stopped).toBe(true);
  const rows=await evidenceRows(page);expect(rows.map(r=>r.source)).toEqual(['microphone','microphone']);expect(rows.map(r=>r.rawText)).toEqual(['คำนวณ','(8+7)*3']);expect(rows.every(r=>!!r.asr)).toBe(true);expect(rows[1].utility?.source).toBe('calculator');
  expect(await page.locator('.voice-user').allTextContents()).toEqual(['คำนวณ','(8+7)*3']);
 }finally{await f.close()}
});
test('dev: microphone English clock uses local clock and does not request web or AI',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['what time is it?']);
 try{await page.goto('./#/cic');await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('ตามนาฬิกาเครื่อง');expect(f.inputs).toHaveLength(0);expect(f.ttsCalls()).toBe(0);const rows=await evidenceRows(page);expect(rows[0].utility?.source).toBe('clock');expect(rows[0].source).toBe('microphone')}finally{await f.close()}
});
test('dev: microphone task answer supplies the pending question and context to the AI route once',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['ช่วยวางแผน','อ่านหนังสือสอบวันเสาร์'],async()=>({tool:'answer',argument:'แบ่งบทที่จะอ่าน แล้วเริ่มจากบทที่ยังไม่เข้าใจครับ'}));
 try{await page.goto('./#/cic');await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('ต้องการวางแผนเรื่องอะไร');await micTurn(page,f,2);await expect(page.getByRole('log')).toContainText('แบ่งบทที่จะอ่าน');expect(f.inputs).toHaveLength(1);expect(f.inputs[0]).toMatchObject({text:'อ่านหนังสือสอบวันเสาร์',question:'ต้องการวางแผนเรื่องอะไรครับ?',history:[{role:'user',text:'ช่วยวางแผน'},{role:'assistant',text:'ต้องการวางแผนเรื่องอะไรครับ?'}]});const rows=await evidenceRows(page);expect(rows).toHaveLength(2);expect(rows[1]).toMatchObject({source:'microphone',rawText:'อ่านหนังสือสอบวันเสาร์'});expect(rows[1].assistant).toBeTruthy();expect(rows[1].asr).toBeTruthy()}finally{await f.close()}
});
test('dev: Stop waits for owned simulated inference settlement and never displays late answer',async({page,baseURL})=>{
 let aborted=false,settled=false,release:()=>void=()=>{};
 const f=await fixture(page,baseURL!,['ช่วยอธิบายวิธีจัดลำดับงาน'],async(_input,signal)=>{signal.addEventListener('abort',()=>aborted=true);await new Promise<void>(r=>release=r);settled=true;return{tool:'answer',argument:'คำตอบเก่าที่ต้องถูกทิ้ง'}});
 try{await page.goto('./#/cic');await micTurn(page,f,1);await expect.poll(()=>f.inputs.length).toBe(1);await page.getByRole('button',{name:'หยุด',exact:true}).click();await expect.poll(()=>aborted).toBe(true);expect(settled).toBe(false);await expect(page.getByRole('status')).not.toContainText('ยุติแล้ว');release();await expect(page.getByRole('status')).toContainText('ยุติแล้ว');expect(settled).toBe(true);await expect(page.getByText('คำตอบเก่าที่ต้องถูกทิ้ง',{exact:false})).toHaveCount(0);expect((await state(page)).stopped).toBe(true);expect(f.ttsCalls()).toBe(0)}finally{release();await f.close()}
});
test('dev: typed pending expression can be answered by microphone without losing the pending slot',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['9*7']);
 try{await page.goto('./#/cic');await page.getByRole('textbox',{name:'ข้อความถึง CiC'}).fill('คิดเลข');await page.getByRole('button',{name:'ส่ง',exact:true}).click();await expect(page.getByRole('log')).toContainText('ต้องการคำนวณสมการอะไร');await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('9*7 = 63');expect(f.inputs).toHaveLength(0);const rows=await evidenceRows(page);expect(rows.map(r=>r.source)).toEqual(['typed','microphone'])}finally{await f.close()}
});
test('held: wrong short Stop transcription is preserved and cannot silently become a Stop command',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['หยุ่น'],async()=>({tool:'ask',argument:'หมายถึงอะไรครับ?'}));
 try{await page.goto('./#/cic');await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('หมายถึงอะไร');expect(f.inputs).toHaveLength(1);expect(f.inputs[0]).toMatchObject({text:'หยุ่น'});const rows=await evidenceRows(page);expect(rows[0]).toMatchObject({source:'microphone',rawText:'หยุ่น',reply:'หมายถึงอะไรครับ?'});await expect(page.getByRole('status')).not.toContainText('ยุติแล้ว')}finally{await f.close()}
});
test('held: microphone unsupported app does not ask AI to expand scope or open native app',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['เปิด PowerShell']);
 try{await page.goto('./#/cic');await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('ตอนนี้ฉันเปิด Chrome, YouTube และ Notepad ได้');expect(f.inputs).toHaveLength(0);expect(f.ttsCalls()).toBe(0);await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว'})).toHaveCount(0)}finally{await f.close()}
});
test('held: a new spoken clock command overrides the old missing expression without reusing it',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['คิดเลข','ตอนนี้กี่โมง']);
 try{await page.goto('./#/cic');await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('ต้องการคำนวณสมการอะไร');await micTurn(page,f,2);await expect(page.getByRole('log')).toContainText('ตามนาฬิกาเครื่อง');expect(f.inputs).toHaveLength(0);const rows=await evidenceRows(page);expect(rows[1].utility?.source).toBe('clock')}finally{await f.close()}
});

test('spoken arithmetic: simulated microphone payload keeps words and uses actual utility without model',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,['คำนวณ','สิบหกบวกเก้า']);
 try{await page.goto('./#/cic');await micTurn(page,f,1);await expect(page.getByRole('log')).toContainText('ต้องการคำนวณสมการอะไร');await micTurn(page,f,2);await expect(page.getByRole('log')).toHaveText('16 + 9 = 25');expect(f.inputs).toHaveLength(0);expect(f.ttsCalls()).toBe(0);const rows=await evidenceRows(page);expect(rows.map(r=>r.rawText)).toEqual(['คำนวณ','สิบหกบวกเก้า']);expect(rows.every(r=>r.source==='microphone'&&!!r.asr)).toBe(true);expect(rows[1].utility?.source).toBe('calculator')}finally{await f.close()}
});

async function localFixture(page:Page){await page.addInitScript(()=>{
 type Local={instance:Speech|null;starts:number;aborts:number;feed:(text:string,final:boolean,end?:boolean)=>void}
 const w=window as typeof window&{localSpeechFixture:Local},state:Local={instance:null,starts:0,aborts:0,feed:(text,final,end)=>{const s=state.instance!;s.onresult?.({results:{length:1,0:{length:1,isFinal:final,0:{transcript:text,confidence:0.9}}}});if(end){s.onspeechend?.();s.onend?.()}}};w.localSpeechFixture=state
 class Speech{processLocally=false;lang='';interimResults=false;continuous=false;maxAlternatives=1;onstart:null|(()=>void)=null;onspeechend:null|(()=>void)=null;onresult:null|((event:unknown)=>void)=null;onerror:null|((event:unknown)=>void)=null;onend:null|(()=>void)=null;static async available(){return 'available'}start(){state.instance=this;state.starts++;setTimeout(()=>this.onstart?.(),0)}stop(){setTimeout(()=>this.onend?.(),0)}abort(){state.aborts++;setTimeout(()=>this.onend?.(),0)}}
 Object.defineProperty(window,'SpeechRecognition',{value:Speech})
})}
test('local live UI: interim calculation never executes; final uses actual calculator once without batch ASR',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,[]);await localFixture(page)
 try{await page.goto('./#/cic');await page.getByRole('checkbox',{name:'ฟังสดในเครื่อง (ทดลอง)',exact:true}).check();await page.getByRole('button',{name:'เริ่มคุย',exact:true}).click();await expect(page.getByRole('status')).toContainText('ฟังอยู่')
  await page.evaluate(()=>{const w=window as unknown as {localSpeechFixture:{feed:(t:string,f:boolean,e?:boolean)=>void}};w.localSpeechFixture.feed('สิบหกบวก',false)});await expect(page.getByLabel('คำที่กำลังพูด',{exact:true})).toHaveText('สิบหกบวก');expect(f.inputs).toHaveLength(0);expect(f.asrCalls()).toBe(0);expect(await page.locator('.voice-user').count()).toBe(0)
  await page.evaluate(()=>{const w=window as unknown as {localSpeechFixture:{feed:(t:string,f:boolean,e?:boolean)=>void}};w.localSpeechFixture.feed('สิบหกบวกเก้า',true,true)});await expect(page.getByRole('log')).toContainText('16 + 9 = 25');expect(f.asrCalls()).toBe(0);expect(f.inputs).toHaveLength(0);const rows=await evidenceRows(page);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({rawText:'สิบหกบวกเก้า',utility:{source:'calculator'},liveSpeech:{source:'browser-on-device',processLocally:true,accepted:false}});expect(rows[0].asr).toBeUndefined()
 }finally{await f.close()}
})
test('local live UI: Stop discards interim speech and no late final can execute',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!,[]);await localFixture(page)
 try{await page.goto('./#/cic');await page.getByRole('checkbox',{name:'ฟังสดในเครื่อง (ทดลอง)',exact:true}).check();await page.getByRole('button',{name:'เริ่มคุย',exact:true}).click();await expect(page.getByRole('status')).toContainText('ฟังอยู่');await page.evaluate(()=>{const w=window as unknown as {localSpeechFixture:{feed:(t:string,f:boolean,e?:boolean)=>void}};w.localSpeechFixture.feed('สิบหกบวกเก้า',false)})
  await page.getByRole('button',{name:'หยุด',exact:true}).click();await expect(page.getByRole('status')).toContainText('ยุติแล้ว');await page.evaluate(()=>{const w=window as unknown as {localSpeechFixture:{feed:(t:string,f:boolean,e?:boolean)=>void}};w.localSpeechFixture.feed('สิบหกบวกเก้า',true,true)});expect(await page.locator('.voice-user').count()).toBe(0);expect(f.asrCalls()).toBe(0);expect(f.inputs).toHaveLength(0)
 }finally{await f.close()}
})
