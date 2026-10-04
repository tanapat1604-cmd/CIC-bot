import {test,expect} from '@playwright/test'
import {once} from 'node:events'
import {setTimeout as delay} from 'node:timers/promises'
import {readFileSync} from 'node:fs'
import {createLiveReply} from '../backend/liveReply'
import {createChatServer} from '../backend/server'
import {calculate,addMinutes} from '../backend/textUtilities'
import {validateEvent} from '../shared/chatProtocol'
import type {TextMessage} from '../shared/chatProtocol'

test('bounded system help distinguishes instruction, enactment, quotes, negation and corrections; other prose reaches model',async()=>{
 const cases=JSON.parse(readFileSync('scripts/help-cases.json','utf8')) as {set:string;id:string;expected:string;turns:string[]}[]
 let calls=0
 const provider={kind:'live' as const,async*stream(){calls++;yield 'raw model: ตั้งเตือนสำเร็จแล้ว'}}
 for(const c of cases.filter(c=>c.set==='development')){
  const messages:TextMessage[]=c.turns.flatMap((text,i)=>i===c.turns.length-1?[{role:'user' as const,text}]:[{role:'user' as const,text},{role:'assistant' as const,text:'ตั้งให้แล้ว [untrusted fixture]'}])
  const before=calls,reply=createLiveReply(provider,{messages,system:'',maxOutputChars:12000},new AbortController().signal)
  let text='';for await(const chunk of reply.stream)text+=chunk
  expect(reply.source,c.id).toBe(c.expected==='system'?'capabilities':c.expected)
  if(['help','system','mixed'].includes(c.expected)){expect(text,c.id).toContain('ไม่ได้');expect(calls,c.id).toBe(before)}
  else {expect(calls,c.id).toBe(before+1);expect(text,c.id).toBe('raw model: ตั้งเตือนสำเร็จแล้ว')}
 }
 const identity={sessionId:'s',operationId:'o'}
 expect(validateEvent({...identity,type:'delta',text:'คำแนะนำ',source:'help'},identity)).toMatchObject({source:'help'})
 expect(()=>validateEvent({...identity,type:'done',source:'help',performedActions:['reminder']},identity)).toThrow()
})

test('documented utility limits have real boundary behavior and never fallback to a model',async()=>{
 expect(calculate('99999999999999')).toBe('99999999999999')
 expect(()=>calculate('999999999999999')).toThrow()
 expect(calculate('1.2345')).toBe('1.2345');expect(()=>calculate('1.23456')).toThrow()
 expect(calculate('+'.repeat(47)+'1')).toBe('1');expect(()=>calculate('+'.repeat(48)+'1')).toThrow()
 expect(calculate(' '.repeat(127)+'1')).toBe('1');expect(()=>calculate(' '.repeat(128)+'1')).toThrow()
 expect(addMinutes('00:00'+' + 1'.repeat(16))).toBe('00:16');expect(()=>addMinutes('00:00'+' + 1'.repeat(17))).toThrow()
 expect(addMinutes('00:00 + 99999')).toBe('10:39 (+69 วัน)');expect(()=>addMinutes('00:00 + 100000')).toThrow()
 let calls=0;const provider={kind:'live' as const,async*stream(){calls++;yield 'unexpected'}}
 for(const input of ['/calc 1 / 0','/calc 2 ** 3','/time 24:00 + 1','/time 14:00 + 1.5','/help calc','/help time']){
  const reply=createLiveReply(provider,{messages:[{role:'user',text:input}],system:'',maxOutputChars:12000},new AbortController().signal)
  let text='';for await(const chunk of reply.stream)text+=chunk
  expect(reply.source).not.toBe('model');expect(text).toMatch(/คำนวณไม่ได้|ขอบเขต|ไม่รองรับ/)
 }
 expect(calls).toBe(0)
})

test('app labels help, tools, raw AI and unfinished mixed streams across desktop, mobile and short screens',async({page})=>{
 let failMixed=true,calls=0
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve})
 const server=createChatServer({provider:{kind:'live',model:'qwen3:0.6b',async*stream(_input,signal){calls++;if(calls===3)await gate;else await delay(700,undefined,{signal});yield 'ต้นฉบับ AI อ้างว่า “ส่งสำเร็จแล้ว”';await delay(1500,undefined,{signal});if(failMixed){failMixed=false;throw Error('controlled outage')}yield '\nข้อความต่อท้าย'}}})
 server.listen(8787,'127.0.0.1');await once(server,'listening')
 const send=async(text:string)=>{await page.getByRole('textbox',{name:'ข้อความถึง CIC'}).fill(text);await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click()}
 const replies=page.getByRole('article',{name:'คำตอบ CIC',exact:true}),stop=page.getByRole('button',{name:'หยุดงาน',exact:true})
 try{
  await page.goto('./#/app');await page.getByRole('button',{name:'การเชื่อมต่อ',exact:true}).click();await page.getByRole('button',{name:'ตรวจการเชื่อมต่อ backend',exact:true}).click();await page.getByRole('button',{name:'เริ่มแชต AI ในเครื่อง',exact:true}).click()
  await send('สอนตั้งเตือนหน่อย');await expect(replies.last()).toContainText('คำแนะนำจากระบบ · ไม่ใช่ AI');await expect(stop).toBeDisabled();expect(calls).toBe(0)
  await send('/help');await expect(replies.last()).toContainText('128 ตัวอักษร');await expect(stop).toBeDisabled();expect(calls).toBe(0)
  await send('/calc 20 - 3');await expect(replies.last()).toContainText('= 17');await expect(replies.last()).toContainText('เครื่องคำนวณในเครื่อง · ไม่ใช่โมเดล');await expect(stop).toBeDisabled()
  await send('ร่างข้อความขอบคุณ แล้วส่งให้ทีม');await expect(replies.last()).toContainText('คำตอบหลายส่วน');await expect(replies.last()).toContainText('ส่วนที่ไม่ได้ทำ');await expect(replies.last()).toContainText('กำลังทยอยตอบ…');await expect(replies.last()).toContainText('ยังไม่ได้ทำงานภายนอก')
  await page.screenshot({path:'test-results/help-mixed-streaming.png'})
  await expect(page.getByRole('alert')).toBeVisible();await expect(replies.last()).toContainText('ตอบไม่สำเร็จ');await expect(replies.last()).toContainText('ต้นฉบับ AI อ้างว่า');await expect(replies.last()).toContainText('คำตอบหลายส่วน')
  await page.screenshot({path:'test-results/help-error.png'})
  const attempts=await replies.count();const users=await page.getByRole('article',{name:'ข้อความของคุณ',exact:true}).count();await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(replies.last()).toContainText('คำตอบหลายส่วน');await expect(stop).toBeDisabled({timeout:10000});await expect(replies.last()).toContainText('จบคำตอบหลายส่วน');await expect(page.getByRole('article',{name:'ข้อความของคุณ',exact:true})).toHaveCount(users);await expect(replies).toHaveCount(attempts+1);await expect(replies.filter({hasText:'ตอบไม่สำเร็จ'})).toHaveCount(1)
  const mixedReply=replies.nth(attempts)
  for(const [width,height] of [[1440,900],[390,844],[360,480]]){
   await page.setViewportSize({width,height});await expect(page.getByRole('textbox',{name:'ข้อความถึง CIC'})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   await mixedReply.scrollIntoViewIfNeeded();await expect(mixedReply.getByText('คำตอบหลายส่วน · ดูแหล่งในแต่ละส่วน',{exact:true})).toBeInViewport();await page.screenshot({path:`test-results/help-${width}x${height}.png`})
   await send('/time 23:59 + 2');await expect(replies.last()).toContainText('00:01 (+1 วัน)');await expect(replies.last()).toContainText('คำนวณเวลาในเครื่อง · ไม่ใช่โมเดล');await expect(stop).toBeDisabled()
  }
  const beforeNext=await replies.count();await page.setViewportSize({width:1440,height:900});await send('เล่าเรื่องสั้น');await expect(page.getByText('กำลังรอคำตอบจาก backend… · ยังไม่ทราบแหล่งคำตอบ',{exact:true})).toBeVisible();await expect(replies).toHaveCount(beforeNext);release();await expect(replies.last()).toContainText('ต้นฉบับ AI อ้างว่า');await expect(replies.last()).toContainText('AI ในเครื่อง · qwen3:0.6b');await stop.click();await expect(replies.last()).toContainText('หยุดกลางทาง');await expect(replies.last()).toContainText('ยังไม่ได้ทำงานภายนอก');await page.screenshot({path:'test-results/help-stopped.png'})
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
