import {test,expect,type Page} from '@playwright/test'
import {once} from 'node:events'
import {createVoiceCore} from '../backend/voice/core'
import {createNotepadCore} from '../backend/notepad/core'
import {createScheduler} from '../backend/core/scheduler'
import {createChatServer} from '../backend/server'
import type {NotepadNative} from '../backend/notepad/native'
async function fixture(page:Page,baseURL:string,delayed=false){
 let opens=0,observations=0,closed=false,release:()=>void=()=>{};const spoken:string[]=[],instanceId=crypto.randomUUID(),scheduler=createScheduler({freeMiB:()=>4096,externalBusy:()=>false})
 const observation={instanceId,observationId:crypto.randomUUID(),monotonicMs:1,geometry:'fixture',pid:123,windowId:'456',foreground:true,text:'',source:'owned-notepad-editor' as const}
 const native:NotepadNative={alive:()=>!closed,observe:async()=>{observations++;return observation},execute:async()=>{throw Error('unused')},close:async()=>{closed=true}}
 const notepad=createNotepadCore({externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>4096,start:async()=>{opens++;closed=false;if(delayed)await new Promise<void>(r=>release=r);return native}})
 const voice=createVoiceCore({scheduler,externalBusy:()=>false,ownerAlive:()=>true,freeMiB:()=>4096,runner:async input=>{if(input.kind!=='tts'||input.phrase===undefined)throw Error('no fake ASR in this suite');spoken.push(input.phrase);return{kind:'tts',phrase:input.phrase,wav:Buffer.alloc(60),elapsedMs:1,peakWorkingSetMiB:32}}})
 const server=createChatServer({voice,notepad,provider:{kind:'live',model:'fixture-no-model',async *stream(){throw Error('Expected a local utility, no model call');yield ''}},origins:[new URL(baseURL).origin]});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port
 await page.route('http://127.0.0.1:8787/**',async route=>{await route.fulfill({response:await route.fetch({url:route.request().url().replace('http://127.0.0.1:8787',base)})})})
 await page.addInitScript(()=>Object.defineProperty(window,'Audio',{value:class{src='';onended=()=>{};play(){return Promise.resolve()}pause(){}}}))
 await page.goto('./?voiceDiagnostics=1#/voice');await page.getByRole('button',{name:'เชื่อมเครื่องมือเสียง',exact:true}).click()
 return{opens:()=>opens,observations:()=>observations,spoken,release:()=>release(),closed:()=>closed,async close(){release();await page.unrouteAll({behavior:'wait'});server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await notepad.close();await voice.close();scheduler.close()}}
}

test('AI app proposal uses the named target and existing scope confirmation; no duplicate app question',async({page,baseURL})=>{
 const f=await fixture(page,baseURL!);const raw='ช่วยเตรียม Notepad เพื่อเปิดจดบันทึกให้หน่อย'
 try{
  await page.route('http://127.0.0.1:8787/assistant/think',route=>{const input=route.request().postDataJSON();return route.fulfill({json:{version:1,operationId:input.operationId,source:'local-ai-proposal',model:'fixture',elapsedMs:1,decision:{tool:'app',argument:'notepad'}}})})
  await page.goto('./#/cic');await page.getByRole('textbox',{name:'ข้อความถึง CiC'}).fill(raw);await page.getByRole('button',{name:'ส่ง',exact:true}).click()
  await expect(page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว'})).toBeVisible();expect(f.opens()).toBe(0)
  await expect(page.getByRole('log')).not.toContainText('ต้องการเปิดโปรแกรมใด');await expect(page.locator('.voice-user')).toHaveText(raw)
  await page.screenshot({path:'validation/2026-10-14-conversation-routing/APP-SCOPE-UI.png'})
  await page.getByRole('button',{name:'อนุญาตใช้แอปครั้งเดียว'}).click();await expect(page.getByRole('log')).toContainText('พร้อมใช้ Notepad');expect(f.opens()).toBe(1);expect(f.observations()).toBeGreaterThanOrEqual(2)
  await page.getByRole('button',{name:'หยุด',exact:true}).click();await expect(page.getByRole('status')).toContainText('ยุติแล้ว')
 }finally{await f.close()}
})
