import {test,expect} from '@playwright/test'
import {once} from 'node:events'
import {writeFile} from 'node:fs/promises'
import {createChatServer} from '../backend/server'
import {createOllamaProvider,ollamaConfig} from '../backend/ollama'

test('installed model aborts when switching chats; interrupted text and sources remain isolated',async({page})=>{
 test.skip(process.env.CIC_TEST_OLLAMA!=='1','Explicit installed-model opt-in only')
 test.setTimeout(60000)
 const signals:AbortSignal[]=[],logs:{status:string}[]=[],errors:string[]=[]
 const provider=createOllamaProvider(ollamaConfig({AI_MODEL:'qwen3:0.6b'}),async(url,init)=>{if(String(url).endsWith('/api/chat'))signals.push(init!.signal as AbortSignal);return fetch(url,init)})
 const server=createChatServer({provider,log:e=>logs.push(e)});server.listen(8787,'127.0.0.1');await once(server,'listening')
 page.on('pageerror',e=>errors.push(e.message))
 const replies=page.getByRole('article',{name:'คำตอบ CIC',exact:true})
 try{
  await page.goto('./#/app');await page.getByRole('button',{name:'การเชื่อมต่อ',exact:true}).click();await page.getByRole('button',{name:'ตรวจการเชื่อมต่อ backend',exact:true}).click();await page.getByRole('button',{name:'เริ่มแชต AI ในเครื่อง',exact:true}).click()
  await page.getByRole('textbox',{name:'ข้อความถึง CIC'}).fill('Write a detailed list of 50 small programming tasks, one sentence each.');await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click()
  await expect(replies.last()).toContainText('AI ในเครื่อง · qwen3:0.6b',{timeout:30000});await expect(page.getByText('กำลังทยอยตอบ…',{exact:true})).toBeVisible()
  const oldName=await page.locator('button[aria-current="page"]:visible').getAttribute('aria-label')
  await page.getByRole('button',{name:'แชตใหม่',exact:true}).click();await expect(replies).toHaveCount(0);await expect.poll(()=>logs.at(-1)?.status).toBe('cancelled');expect(signals.at(-1)?.aborted).toBe(true)
  await page.waitForTimeout(700);await expect(replies).toHaveCount(0)
  await page.getByRole('button',{name:oldName!,exact:true}).click();await expect(replies).toHaveCount(1);await expect(replies.last()).toContainText('หยุดกลางทาง');await expect(replies.last()).toContainText('AI ในเครื่อง · qwen3:0.6b');await expect(replies.last()).toContainText('ยังไม่ได้ทำงานภายนอก')
  const partial=await replies.last().textContent();await page.waitForTimeout(500);expect(await replies.last().textContent()).toBe(partial)
  await page.getByRole('textbox',{name:'ข้อความถึง CIC'}).fill('/help');await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await expect(replies.last()).toContainText('คำแนะนำจากระบบ · ไม่ใช่ AI');await expect(page.getByRole('button',{name:'หยุดงาน',exact:true})).toBeDisabled();expect(signals).toHaveLength(1)
  for(const [width,height] of [[1440,900],[390,844],[360,480]]){await page.setViewportSize({width,height});await expect(page.getByRole('textbox',{name:'ข้อความถึง CIC'})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/ollama-switch-${width}x${height}.png`})}
  expect(errors).toEqual([]);await writeFile('test-results/ollama-switch.json',JSON.stringify({model:provider.model,logs,errors,rawPartial:partial,actualReplies:await replies.allTextContents(),cancelled:true,isolated:true,upstreamCalls:signals.length},null,2))
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})
