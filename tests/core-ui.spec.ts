import {test,expect} from '@playwright/test'
import {once} from 'node:events'
import {createChatServer} from '../backend/server'
import {createCore} from '../backend/core/core'
test('CIC Core UI uses real authenticated backend tools after review; fixture RAM, no model/control',async({page})=>{
 const core=createCore({freeMiB:()=>1024}),server=createChatServer({core,origins:['http://127.0.0.1:4173'],requestsPerMinute:100});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
 try{
 await page.route('http://127.0.0.1:8787/**',async route=>{const r=await route.fetch({url:route.request().url().replace('http://127.0.0.1:8787',base)});await route.fulfill({response:r})});
 await page.goto('./#/core');await page.getByRole('button',{name:'ตรวจบริการและความสามารถ',exact:true}).click();await expect(page.getByRole('status')).toContainText('พร้อมวางแผน');await page.getByLabel('คำสั่งของคุณ').fill('/calc (81-27)/3');await page.getByRole('button',{name:'วางแผนงาน',exact:true}).click();await expect(page.getByRole('heading',{name:'รอคุณตรวจและอนุญาต',exact:true})).toBeVisible();await expect(page.getByText('ผลเครื่องมือในเครื่อง · ตรวจผลแล้ว · ไม่ใช่คำตอบโมเดล',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'อนุญาตงานนี้และเริ่ม',exact:true}).click();await expect(page.getByRole('heading',{name:'สำเร็จและตรวจผลแล้ว',exact:true})).toBeVisible();await expect(page.getByRole('article',{name:'งาน Core'})).toContainText('(81-27)/3 = 18');
 for(const[width,height]of[[1440,900],[390,844],[360,480]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.tools/core-'+width+'.png',fullPage:true})}
 await page.getByRole('button',{name:'หยุดงาน Core ทั้งหมดของฉัน',exact:true}).click();await expect(page.getByRole('status')).toContainText('บริการยืนยันว่าไม่มีงาน');
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})
test('public Core disables local calls; malformed capability version cannot show ready',async({page})=>{
 const local:string[]=[];page.on('request',r=>{if(/:8787|:11434/.test(r.url()))local.push(r.url())});await page.route('http://core-demo.test/**',async route=>{const response=await route.fetch({url:route.request().url().replace('http://core-demo.test','http://127.0.0.1:4173')});await route.fulfill({response})});await page.goto('http://core-demo.test/CIC-bot/#/core');await expect(page.getByRole('button',{name:'ตรวจบริการและความสามารถ',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'วางแผนงาน',exact:true})).toBeDisabled();expect(local).toEqual([]);
 await page.route('http://127.0.0.1:8787/**',route=>route.fulfill({json:route.request().url().endsWith('/session')?{ready:true}:{version:999}}));await page.goto('./#/core');await page.getByRole('button',{name:'ตรวจบริการและความสามารถ',exact:true}).click();await expect(page.getByRole('status')).toContainText('เชื่อมบริการไม่ได้');await expect(page.getByRole('button',{name:'วางแผนงาน',exact:true})).toBeDisabled();
})
