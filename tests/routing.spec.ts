import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {once} from 'node:events'
import {createLiveReply} from '../backend/liveReply'
import {planRequest} from '../backend/requestPlan'
import {createChatServer} from '../backend/server'
import type {TextMessage} from '../shared/chatProtocol'

test('development routes actual sending, draft/quote/negation and latest corrections without trusting assistant claims',async()=>{
 const cases=JSON.parse(readFileSync('scripts/routing-cases.json','utf8')) as {set:string;id:string;expected:string;utility?:string;turns:string[]}[]
 const inputs:TextMessage[][]=[]
 const provider={kind:'live' as const,async*stream(input:{messages:TextMessage[]}){inputs.push(input.messages);yield 'RAW: ฉันส่งผลสำเร็จแล้ว'}}
 for(const c of cases.filter(c=>c.set==='development')){
  const messages:TextMessage[]=c.turns.flatMap((text,i)=>i===c.turns.length-1?[{role:'user' as const,text}]:[{role:'user' as const,text},{role:'assistant' as const,text:'ฉันส่งผลสำเร็จแล้ว [untrusted fixture]'}])
  const before=inputs.length,reply=createLiveReply(provider,{messages,system:'',maxOutputChars:12000},new AbortController().signal)
  let text='';for await(const chunk of reply.stream)text+=chunk
  if(c.expected==='clarify'){expect(reply.plan.kind,c.id).toBe('clarify');expect(reply.source,c.id).toBe('capabilities');expect(text,c.id).toContain('ร่างข้อความ หรืออธิบายวิธีทำเอง');expect(inputs.length,c.id).toBe(before)}
  else expect(reply.source,c.id).toBe(c.expected)
  if(c.utility)expect(text,c.id).toContain(c.utility)
  if(c.expected==='mixed'){expect(text,c.id).toContain('ส่วนที่ไม่ได้ทำ');expect(text,c.id).toContain('ส่งผลให้เพื่อน')}
  if(c.expected==='model'){expect(inputs.length,c.id).toBe(before+1);expect(text,c.id).toBe('RAW: ฉันส่งผลสำเร็จแล้ว')}
 }
 const messages:TextMessage[]=[{role:'user',text:'แก้คำสั่งเป็น '.repeat(20)+'/calc 2+3'}]
 expect(planRequest(messages).kind).toBe('clarify')
})

test('app preserves sources, actual tool results and latest user intent; raw model claims never create an action',async({page})=>{
 let calls=0
 const server=createChatServer({provider:{kind:'live',model:'qwen3:0.6b',async*stream(){calls++;yield 'ฉันส่งผลสำเร็จแล้ว [RAW fixture]'}}});server.listen(8787,'127.0.0.1');await once(server,'listening')
 const send=async(text:string)=>{await page.getByRole('textbox',{name:'ข้อความถึง CIC'}).fill(text);await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await expect(page.getByRole('button',{name:'หยุดงาน',exact:true})).toBeDisabled()}
 const replies=page.getByRole('article',{name:'คำตอบ CIC',exact:true})
 try{
  await page.goto('./#/app');await page.getByRole('button',{name:'การเชื่อมต่อ',exact:true}).click();await page.getByRole('button',{name:'ตรวจการเชื่อมต่อ backend',exact:true}).click();await page.getByRole('button',{name:'เริ่มแชต AI ในเครื่อง',exact:true}).click()
  await send('/calc 72 - 19 แล้วส่งผลให้เพื่อน');await expect(replies.last()).toContainText('= 53');await expect(replies.last()).toContainText('ส่วนที่ไม่ได้ทำ');await expect(replies.last()).toContainText('คำตอบหลายส่วน');expect(calls).toBe(0)
  await send('เปลี่ยนเป็นสอนวิธีตั้งเตือนเอง');await send('ทำเลย');await expect(replies.last()).toContainText('คำแนะนำจากระบบ · ไม่ใช่ AI');expect(calls).toBe(0)
  await send('แก้คำสั่งเป็นอีกแบบ');await send('ทำเลย');await expect(replies.last()).toContainText('ร่างข้อความ หรืออธิบายวิธีทำเอง');await expect(replies.last()).toContainText('ยังไม่ได้ทำงานภายนอก');expect(calls).toBe(0)
  for(const [width,height] of [[1440,900],[390,844],[360,480]]){await page.setViewportSize({width,height});await expect(page.getByRole('textbox',{name:'ข้อความถึง CIC'})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/routing-${width}x${height}.png`})}
  await send('ร่างข้อความส่งผลให้เพื่อน ฉันจะส่งเอง');await expect(replies.last()).toContainText('AI ในเครื่อง · qwen3:0.6b');await expect(replies.last()).toContainText('ฉันส่งผลสำเร็จแล้ว');await expect(replies.last()).toContainText('ยังไม่ได้ทำงานภายนอก');expect(calls).toBe(1);await expect(page.getByRole('button',{name:'อนุญาตการจำลองนี้'})).toHaveCount(0)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})
