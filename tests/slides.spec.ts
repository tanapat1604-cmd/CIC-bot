import { test, expect } from '@playwright/test'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { createSlidesManager } from '../backend/slides'
import { createChatServer } from '../backend/server'
import { parseSlideBrief, outlinePages, type SlideBrief } from '../shared/slides'
const brief:SlideBrief={title:'การแยกขยะ',brief:'เนื้อหาที่ผู้ใช้ตรวจสำหรับสองหน้า',pages:[{title:'ขยะทั่วไป',body:['แยกจากวัสดุที่นำกลับมาใช้ใหม่ได้']},{title:'วัสดุรีไซเคิล',body:['ทำความสะอาดและแยกวัสดุตามประเภท']} ]}
const folder=async()=>{await mkdir('.tools',{recursive:true});return mkdtemp(path.resolve('.tools/slides-tests-'))}
const files=async(b:SlideBrief,d:string)=>{for(const f of ['deck.pptx','deck.pdf',...b.pages.map((_,i)=>`slide-0${i+1}.png`)])await writeFile(path.join(d,f),'test fixture content'.repeat(10))}
test('brief validation bounds native text and refuses executable or arbitrary-path inputs',()=>{
 expect(parseSlideBrief(brief)).toEqual(brief)
 expect(outlinePages('ชื่อหน้า\nข้อความ\n\nหน้าสอง\nข้อความสอง')).toHaveLength(2)
 for(const input of [{...brief,design:'unknown'},{...brief,design:123},{...brief,path:'C:/Windows'},{...brief,pages:[]},{...brief,pages:[...brief.pages,{title:'x'.repeat(66),body:['text']}]},{...brief,pages:[...brief.pages,{title:'valid',body:['x'.repeat(116)]}]},{...brief,parentId:'../../other'}])expect(()=>parseSlideBrief(input)).toThrow()
})
test('new revisions preserve originals and enforce ownership and filename allowlist',async()=>{
 const manager=createSlidesManager({root:await folder(),ready:true,execute:files})
 const first=manager.create('owner',{...brief,design:'professional'});await expect.poll(()=>manager.get('owner',first.id).state).toBe('ready')
 const original=await manager.file('owner',first.id,'deck.pptx')
 const revision=manager.create('owner',{...brief,title:'ฉบับแก้ไข',design:'jarvis',parentId:first.id});await expect.poll(()=>manager.get('owner',revision.id).state).toBe('ready')
 expect(first.design).toBe('professional');expect(revision.design).toBe('jarvis');expect(revision.id).not.toBe(first.id);expect(revision.parentId).toBe(first.id);expect(await manager.file('owner',first.id,'deck.pptx')).toEqual(original)
 expect(()=>manager.get('other',first.id)).toThrow('not-found');expect(()=>manager.cancel('other',first.id)).toThrow('not-found')
 await expect(manager.file('owner',first.id,'../../package.json')).rejects.toThrow('not-found')
})
test('one worker, caller cancellation and late completion never publish cancelled files',async()=>{
 let signal:AbortSignal|undefined, entered:()=>void=()=>{}, release:()=>void=()=>{}
 const started=new Promise<void>(resolve=>{entered=resolve})
 const manager=createSlidesManager({root:await folder(),ready:true,execute:async(b,d,s)=>{signal=s;entered();await new Promise<void>(resolve=>{release=resolve});await files(b,d)}})
 const job=manager.create('owner',brief);expect(()=>manager.create('owner',brief)).toThrow('busy')
 await started;expect(manager.get('owner',job.id).state).toBe('running');manager.cancel('owner',job.id)
 expect(signal?.aborted).toBe(true);release();await expect.poll(()=>manager.get('owner',job.id).state).toBe('cancelled')
 await expect(manager.file('owner',job.id,'deck.pptx')).rejects.toThrow('not-found')
})
test('deadline and missing preview fail closed and sanitize internal errors',async()=>{
 const timeout=createSlidesManager({root:await folder(),ready:true,timeoutMs:20,execute:async()=>{await new Promise(resolve=>setTimeout(resolve,50))}})
 const job=timeout.create('owner',brief);await expect.poll(()=>timeout.get('owner',job.id).state).toBe('error');expect(timeout.get('owner',job.id).error).toBe('timeout')
 const partial=createSlidesManager({root:await folder(),ready:true,execute:async(_,d)=>{await writeFile(path.join(d,'deck.pptx'),'x'.repeat(128))}})
 const failed=partial.create('owner',brief);await expect.poll(()=>partial.get('owner',failed.id).state).toBe('error');expect(partial.get('owner',failed.id).error).toBe('render-failed')
})
test('slide API requires local session and Origin, protects job ownership and files',async()=>{
 const manager=createSlidesManager({root:await folder(),ready:true,execute:files});const server=createChatServer({slides:manager,requestsPerMinute:1,origins:['http://127.0.0.1:4173']});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`,origin='http://127.0.0.1:4173'
 try{
  const unauth=await fetch(base+'/slides/jobs',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(brief)});expect(unauth.status).toBe(401)
  const session=await fetch(base+'/session',{method:'POST',headers:{Origin:origin}});const cookie=session.headers.get('set-cookie')!.split(';')[0]
  expect((await fetch(base+'/slides/jobs',{method:'POST',headers:{Origin:'https://example.com',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(brief)})).status).toBe(403)
  const response=await fetch(base+'/slides/jobs',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(brief)});expect(response.status).toBe(202);const job=await response.json();await expect.poll(()=>manager.get(cookie.split('=')[1],job.id).state).toBe('ready')
  expect((await fetch(base+`/slides/jobs/${job.id}/files/deck.pptx`,{headers:{Cookie:cookie}})).status).toBe(200)
  expect((await fetch(base+`/slides/jobs/${job.id}/cancel`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:'{}'})).status).toBe(200)
  const other=await fetch(base+'/session',{method:'POST',headers:{Origin:origin}});expect((await fetch(base+`/slides/jobs/${job.id}`,{headers:{Cookie:other.headers.get('set-cookie')!.split(';')[0]}})).status).toBe(404)
 }finally{server.closeAllConnections();server.close();await once(server,'close')}
})
test('slides UI preserves outline, shows cancel/error/result and fits desktop/mobile/short',async({page})=>{
 let state='running',posts=0;let submitted:SlideBrief|undefined;const id='11111111-1111-4111-8111-111111111111'
 await page.route('http://127.0.0.1:8787/**',async route=>{
  const url=new URL(route.request().url());let body:unknown={}
  if(url.pathname==='/slides/status')body={configured:true}
  else if(url.pathname==='/slides/jobs'&&route.request().method()==='POST'){posts++;submitted=route.request().postDataJSON();body={id,title:brief.title,state,pageCount:2,created:0}}
  else if(url.pathname.endsWith('/cancel')){state='cancelled';body={id,title:brief.title,state,pageCount:2,created:0}}
  else if(url.pathname.includes('/slides/jobs/'))body={id,title:brief.title,state,pageCount:2,created:0,...(state==='error'?{error:'render-failed'}:{})}
  await route.fulfill({json:body})
 })
 await page.goto('./#/slides');await page.getByRole('button',{name:'ตรวจเครื่องมือในเครื่อง'}).click()
 await page.getByLabel('ชื่อผลงาน',{exact:true}).fill(brief.title);await page.getByLabel('โจทย์และข้อเท็จจริง').fill(brief.brief);await page.getByLabel('โครงเรื่อง 2–8 หน้า').fill(brief.pages.map(p=>p.title+'\n'+p.body.join('\n')).join('\n\n'))
 await expect(page.getByRole('radio',{name:/แบบ B/})).toBeChecked();await page.getByRole('button',{name:'ตรวจโครงเรื่อง'}).click();await page.getByRole('checkbox').check();await page.getByRole('radio',{name:/แบบ A/}).check();await expect(page.getByRole('checkbox')).toHaveCount(0);await page.getByRole('button',{name:'ตรวจโครงเรื่อง'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'สร้างไฟล์สไลด์'}).click();await expect(page.getByRole('status')).toContainText('กำลังสร้าง')
 await page.getByRole('button',{name:'ยกเลิกงานสไลด์'}).click();await expect(page.getByRole('status')).toContainText('ยกเลิกแล้ว');expect(posts).toBe(1);expect(submitted?.design).toBe('professional')
 state='error';await page.getByRole('button',{name:'สร้างไฟล์สไลด์'}).click();await expect(page.getByRole('status')).toContainText('สร้างไม่สำเร็จ');await expect(page.getByLabel('ชื่อผลงาน',{exact:true})).toHaveValue(brief.title)
 for(const[width,height]of[[1440,900],[390,844],[360,480]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.tools/slides-ui-${width}.png`,fullPage:true})}
})

test('leaving the slide route stops its active job at the navigation boundary',async({page})=>{
 const id='22222222-2222-4222-8222-222222222222';let cancellations=0
 await page.route('http://127.0.0.1:8787/**',async route=>{const url=route.request().url();if(url.endsWith('/cancel'))cancellations++;await route.fulfill({json:url.endsWith('/slides/status')?{configured:true}:url.includes('/slides/jobs')?{id,title:brief.title,state:'running',pageCount:2,created:0}:{}})})
 await page.goto('./#/slides');await page.getByRole('button',{name:'ตรวจเครื่องมือในเครื่อง'}).click()
 await page.getByLabel('ชื่อผลงาน',{exact:true}).fill(brief.title);await page.getByLabel('โจทย์และข้อเท็จจริง').fill(brief.brief);await page.getByLabel('โครงเรื่อง 2–8 หน้า').fill(brief.pages.map(p=>p.title+'\n'+p.body.join('\n')).join('\n\n'))
 await page.getByRole('button',{name:'ตรวจโครงเรื่อง'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'สร้างไฟล์สไลด์'}).click();await expect(page.getByRole('status')).toContainText('กำลังสร้าง')
 await page.getByRole('link',{name:'กลับแชต',exact:true}).click();await expect.poll(()=>cancellations).toBeGreaterThan(0)
})

test('unverified native stop is an error and blocks subsequent compute jobs',async()=>{
 const manager=createSlidesManager({root:await folder(),ready:true,execute:async()=>{throw Error('stop-unverified')}})
 const job=manager.create('owner',brief);await expect.poll(()=>manager.get('owner',job.id).state).toBe('error')
 expect(manager.get('owner',job.id).error).toBe('stop-unverified');expect(manager.isBusy()).toBe(true);expect(()=>manager.create('owner',brief)).toThrow('busy')
})

test('supported designs retain text and reject non-string design values',()=>{
 for(const design of ['professional','jarvis'] as const){const value=parseSlideBrief({...brief,design});expect(value.design).toBe(design);expect(value.pages).toEqual(brief.pages)}
 for(const design of [['jarvis'],{toString:()=> 'jarvis'},null])expect(()=>parseSlideBrief({...brief,design})).toThrow()
})
