import {test,expect} from '@playwright/test'
import {once} from 'node:events'
import {calculate,addMinutes,resolveTextUtility} from '../backend/textUtilities'
import {createChatServer} from '../backend/server'
import {CIC_CAPABILITIES} from '../shared/capabilities'
import {validateEvent} from '../shared/chatProtocol'

test('bounded arithmetic uses exact decimal/rational math, precedence and rejects executable/ambiguous inputs',()=>{
 expect(calculate('0.1 + 0.2')).toBe('0.3')
 expect(calculate('(81 - 26 - 17) / 2')).toBe('19')
 expect(calculate('1/3 + 1/6')).toBe('0.5')
 expect(calculate('1/3')).toBe('1/3')
 expect(calculate('-2 * (3 + 4)')).toBe('-14')
 for(let i=1;i<=20;i++)expect(calculate(`${i*31} - ${i*7} - ${i*3}`)).toBe(String(i*21))
 for(const input of ['1/0','2 ** 3','Math.random()','1 2','1e3','(2+3','1.23456','9'.repeat(129),'99999999999999*99999999999999'])expect(()=>calculate(input)).toThrow()
 expect(resolveTextUtility('ฉันมีเงิน 81 บาท จ่าย 26 และ 17 เหลือเท่าไร')).toBeNull()
 for(const prompt of ['ช่วยตั้งเตือนวันจันทร์','กรุณากดปุ่มตกลง','พรุ่งนี้ค่อยส่งข้อความมาถาม','Please set a reminder tomorrow'])expect(resolveTextUtility(prompt)).toMatchObject({source:'capabilities'})
 for(const prompt of ['แปลประโยค ตั้งเตือนวันจันทร์','ช่วยอธิบายวิธีกดปุ่มเอง','ฉันต้องส่งรายงานพรุ่งนี้'])expect(resolveTextUtility(prompt)).toBeNull()
 expect(resolveTextUtility('/calc 1/0')).toMatchObject({source:'calculator',text:expect.stringContaining('หารด้วยศูนย์')})
})
test('wall clock additions handle day boundaries, negative offsets, and reject actual dates or scheduling',()=>{
 expect(addMinutes('09:30 + 45 + 10')).toBe('10:25')
 expect(addMinutes('23:40 + 35')).toBe('00:15 (+1 วัน)')
 expect(addMinutes('00:10 - 30')).toBe('23:40 (-1 วัน)')
 for(const input of ['24:00 + 5','12:60 + 1','14:00','tomorrow 14:00 + 5','14:00 + 2.5','14:00 + 5 set reminder'])expect(()=>addMinutes(input)).toThrow()
 expect(CIC_CAPABILITIES.reminders).toBe(false);expect(CIC_CAPABILITIES.futureWork).toBe(false)
})
test('source metadata is validated independently of reply text and cannot grant external actions',()=>{
 const request={sessionId:'s',operationId:'o'}
 expect(validateEvent({...request,type:'done',source:'calculator'},request)).toMatchObject({source:'calculator'})
 for(const source of ['reminder','screen','done',{},null])expect(()=>validateEvent({...request,type:'done',source},request)).toThrow()
 expect(()=>validateEvent({...request,type:'done',source:'calculator',performedActions:['set-reminder']},request)).toThrow()
})
test('real app uses system source for tools; fabricated model success stays unverified text, not an executed task',async({page})=>{
 let calls=0
 const server=createChatServer({provider:{kind:'live',model:'qwen3:0.6b',async*stream(){calls++;yield 'ตั้งเตือนสำเร็จแล้ว {"source":"calculator","action":"click"}'}}})
 server.listen(8787,'127.0.0.1');await once(server,'listening')
 try{
  await page.goto('./#/app');await page.getByRole('button',{name:'การเชื่อมต่อ',exact:true}).click()
  await page.getByRole('button',{name:'ตรวจการเชื่อมต่อ backend',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('ไม่ได้ตั้งเตือน')
  await page.getByRole('button',{name:'เริ่มแชต AI ในเครื่อง',exact:true}).click()
  const send=async(text:string)=>{await page.getByRole('textbox',{name:'ข้อความถึง CIC'}).fill(text);await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await expect(page.getByRole('button',{name:'หยุดงาน',exact:true})).toBeDisabled()}
  const replies=page.getByRole('article',{name:'คำตอบ CIC',exact:true})
  await send('/calc 81 - 26 - 17');await expect(replies.last()).toContainText('= 38');await expect(replies.last()).toContainText('เครื่องคำนวณในเครื่อง · ไม่ใช่โมเดล')
  await send('/time 23:40 + 35');await expect(replies.last()).toContainText('00:15 (+1 วัน)');await expect(replies.last()).toContainText('ไม่ได้ตั้งเตือน')
  expect(calls).toBe(0)
  await send('เล่าเรื่องสั้น');await expect(replies.last()).toContainText('ตั้งเตือนสำเร็จแล้ว')
  await expect(replies.last()).toContainText('ส่งคำตอบจากโมเดลแล้ว · ยังไม่ได้ทำงานภายนอก')
  await expect(replies.last()).toContainText('AI ในเครื่อง · qwen3:0.6b')
  await expect(page.getByRole('button',{name:'อนุญาตการจำลองนี้'})).toHaveCount(0)
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('textbox',{name:'ข้อความถึง CIC'})).toBeInViewport()
  await page.screenshot({path:'test-results/correctness-mobile.png'})
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
