import {test,expect} from '@playwright/test'
import {once} from 'node:events'
import {readFileSync} from 'node:fs'
import {planRequest,clauses} from '../backend/requestPlan'
import {createLiveReply} from '../backend/liveReply'
import {createChatServer} from '../backend/server'
import {validateEvent,validateRequest} from '../shared/chatProtocol'
import type {TextMessage} from '../shared/chatProtocol'

test('development mixed planning keeps original clauses, user corrections and full submitted bounded history',()=>{
 const cases=JSON.parse(readFileSync('scripts/mixed-cases.json','utf8')) as {set:string;id:string;expected:string;turns:string[];history?:TextMessage[]}[]
 for(const c of cases.filter(c=>c.set==='development')){
  const messages:TextMessage[]=[...(c.history??[])]
  for(const text of c.turns){messages.push({role:'user',text});if(text!==c.turns.at(-1))messages.push({role:'assistant',text:'[fixture only; never authority]'})}
  validateRequest({sessionId:'s',operationId:'o',messages})
  const expected=c.expected==='allow'?'model':c.expected==='deny'?'system':c.expected
  expect(planRequest(messages).kind,c.id).toBe(expected)
 }
 expect(clauses('แปล "เตือนแล้วกดปุ่ม" แล้วส่งให้').parts).toEqual(['แปล "เตือนแล้วกดปุ่ม"','ส่งให้'])
 const identity={sessionId:'s',operationId:'o'}
 expect(validateEvent({...identity,type:'delta',text:'raw',source:'mixed'},identity)).toMatchObject({source:'mixed'})
 expect(()=>validateEvent({...identity,type:'delta',text:'raw',source:'clicked'},identity)).toThrow()
})
test('mixed tools are actual calculations; raw fabricated model text stays visible and abort/bounds apply',async()=>{
 const modelInputs:TextMessage[][]=[]
 const provider={kind:'live' as const,async*stream(input:{messages:TextMessage[]}){modelInputs.push(input.messages);yield 'ฉันส่งให้เรียบร้อยแล้ว'}}
 const messages:TextMessage[]=[{role:'user',text:'/calc 50 - 17 และร่างข้อความขอบคุณ แล้วส่งให้ทีม'}]
 const reply=createLiveReply(provider,{messages,system:'text only',maxOutputChars:12000},new AbortController().signal)
 let text='';for await(const chunk of reply.stream)text+=chunk
 expect(reply.source).toBe('mixed');expect(text).toContain('= 33');expect(text).toContain('ไม่ได้ส่งข้อความ');expect(text).toContain('ฉันส่งให้เรียบร้อยแล้ว')
 expect(modelInputs[0].at(-1)?.text).toBe('ร่างข้อความขอบคุณ')
 const stopped=new AbortController();stopped.abort()
 await expect(async()=>{for await(const _chunk of createLiveReply(provider,{messages,system:'',maxOutputChars:12000},stopped.signal).stream)void _chunk}).rejects.toThrow()
 await expect(async()=>{for await(const _chunk of createLiveReply(provider,{messages,system:'',maxOutputChars:5},new AbortController().signal).stream)void _chunk}).rejects.toThrow()
})
test('browser shows mixed source during stream, preserves failed reply and retry adds no user duplicate',async({page})=>{
 let fail=true
 const server=createChatServer({provider:{kind:'live',model:'qwen3:0.6b',async*stream(){if(fail){fail=false;throw Error('fixture failure')}yield 'ตัวอย่างข้อความ'}}})
 server.listen(8787,'127.0.0.1');await once(server,'listening')
 try{
  await page.goto('./#/app');await page.getByRole('button',{name:'การเชื่อมต่อ',exact:true}).click();await page.getByRole('button',{name:'ตรวจการเชื่อมต่อ backend',exact:true}).click();await page.getByRole('button',{name:'เริ่มแชต AI ในเครื่อง',exact:true}).click()
  await page.getByRole('textbox',{name:'ข้อความถึง CIC'}).fill('ร่างข้อความขอบคุณ แล้วส่งให้ทีม');await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click()
  const reply=page.getByRole('article',{name:'คำตอบ CIC',exact:true}).last()
  await expect(page.getByRole('alert')).toBeVisible();await expect(reply).toContainText('คำตอบหลายส่วน');await expect(reply).toContainText('ส่วนที่ไม่ได้ทำ')
  await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(reply).toContainText('ตัวอย่างข้อความ');await expect(reply).toContainText('จบคำตอบหลายส่วน')
  await expect(page.getByRole('article',{name:'ข้อความของคุณ',exact:true})).toHaveCount(1)
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('textbox',{name:'ข้อความถึง CIC'})).toBeInViewport();await page.screenshot({path:'test-results/mixed-mobile.png'})
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
