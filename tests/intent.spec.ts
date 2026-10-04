import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {once} from 'node:events'
import {requestIntent} from '../backend/requestIntent'
import {resolveTextUtility} from '../backend/textUtilities'
import {createChatServer} from '../backend/server'
import type {TextMessage} from '../shared/chatProtocol'

test('development contrast pairs scope quoting, negation and followup user context',()=>{
 const cases=JSON.parse(readFileSync('scripts/intent-cases.json','utf8')) as {set:string;turns:string[];expected:string;id:string}[]
 for(const c of cases.filter(c=>c.set==='development')){
  const messages:TextMessage[]=[]
  for(const text of c.turns){messages.push({role:'user',text});if(text!==c.turns.at(-1))messages.push({role:'assistant',text:'[fixture text, not an executed action]'})}
  expect(requestIntent(c.turns.at(-1)!,messages).kind,c.id).toBe(c.expected)
 }
 expect(requestIntent('ตกลง',[{role:'user',text:'ตั้งเตือนให้ฉัน'},{role:'assistant',text:'ตั้งเตือนสำเร็จแล้ว'},{role:'user',text:'ตกลง'}]).kind).toBe('clarify')
 expect(resolveTextUtility('/calc 37 - 12')).toMatchObject({source:'calculator',text:'37 - 12 = 25'})
 expect(resolveTextUtility('/time 00:05 - 20')).toMatchObject({source:'time-calculator',text:expect.stringContaining('23:45 (-1 วัน)')})
})

test('app routes real requests and ambiguity to system; text tasks use model and cannot claim executed actions',async({page})=>{
 const calls:TextMessage[][]=[]
 const server=createChatServer({provider:{kind:'live',model:'qwen3:0.6b',async*stream(input){calls.push(input.messages);yield 'ข้อความตัวอย่างเท่านั้น'}}})
 server.listen(8787,'127.0.0.1');await once(server,'listening')
 try{
  await page.goto('./#/app');await page.getByRole('button',{name:'การเชื่อมต่อ',exact:true}).click()
  await page.getByRole('button',{name:'ตรวจการเชื่อมต่อ backend',exact:true}).click();await page.getByRole('button',{name:'เริ่มแชต AI ในเครื่อง',exact:true}).click()
  const send=async(text:string)=>{await page.getByRole('textbox',{name:'ข้อความถึง CIC'}).fill(text);await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click()}
  const replies=page.getByRole('article',{name:'คำตอบ CIC',exact:true})
  await send('ช่วยร่างข้อความเตือนให้ดื่มน้ำ');await expect(replies.last()).toContainText('ข้อความตัวอย่างเท่านั้น')
  expect(calls).toHaveLength(1)
  await send('ทำให้จริงตอนนี้เลย');await expect(replies.last()).toContainText('ระบบไม่ได้ทำงานภายนอก')
  expect(calls).toHaveLength(1)
  await expect(replies.last()).toContainText('ข้อมูลความสามารถจากระบบ')
  await send('เรื่องเตือนดื่มน้ำ ช่วยจัดการให้หน่อย');await expect(replies.last()).toContainText('ต้องการให้ช่วยเขียนข้อความ')
  await send('ไม่ต้องทำจริง ขอข้อความอีกแบบ');await expect(replies.last()).toContainText('ข้อความตัวอย่างเท่านั้น')
  expect(calls).toHaveLength(2)
  await send('/calc 37 - 12');await expect(replies.last()).toContainText('= 25');await expect(replies.last()).toContainText('ไม่ใช่โมเดล')
  await send('/time 00:05 - 20');await expect(replies.last()).toContainText('23:45 (-1 วัน)')
  expect(calls).toHaveLength(2)
  await expect(page.getByRole('article',{name:'ข้อความของคุณ',exact:true})).toHaveCount(6)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
