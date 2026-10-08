import {test,expect,type Page} from '@playwright/test'
type FixtureWindow=Window & {captureTracks:MediaStreamTrack[];captureRequests:number;captureOptions?:DisplayMediaStreamOptions;resolveCapture?:()=>void;rejectedCapture?:boolean}
async function fixture(page:Page,mode='normal'){
 await page.addInitScript((mode)=>{
  const w=window as unknown as FixtureWindow;w.captureTracks=[];w.captureRequests=0
  if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{}})
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async(options:DisplayMediaStreamOptions)=>{
   w.captureRequests++;w.captureOptions=options
   if(mode==='denied')throw new DOMException('Fixture denied','NotAllowedError')
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#071923';ctx.fillRect(0,0,640,360);ctx.fillStyle='#67e8f9';ctx.font='30px sans-serif';ctx.fillText('CIC synthetic screen',30,80);const stream=canvas.captureStream(2);w.captureTracks.push(...stream.getTracks())
   if(mode!=='unknown')Object.defineProperty(stream.getVideoTracks()[0],'getSettings',{configurable:true,value:()=>({displaySurface:'window'})});
   if(mode==='monitor')Object.defineProperty(stream.getVideoTracks()[0],'getSettings',{value:()=>({displaySurface:'monitor'})})
   if(mode==='pending')await new Promise<void>(resolve=>{w.resolveCapture=resolve})
   return stream
  }})
 },mode)
}
test('screen preview is explicit, no audio/backend, snapshot stops and clears tracks',async({page})=>{
 await fixture(page);await page.clock.install();const network:string[]=[];page.on('request',r=>{if(r.url().includes(':8787')||r.url().includes(':11434'))network.push(r.url())})
 await page.goto('./#/screen');expect(await page.evaluate(()=>(window as unknown as FixtureWindow).captureRequests)).toBe(0)
 await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('กำลังแชร์')
 expect(await page.evaluate(()=>(window as unknown as FixtureWindow).captureOptions?.audio)).toBe(false)
 await page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม'}).click();await expect(page.getByRole('img',{name:'ภาพหนึ่งเฟรมจากหน้าต่างที่คุณเลือก'})).toBeVisible()
 await expect(page.getByRole('region',{name:'ภาพหนึ่งเฟรม'})).toContainText('640×360')
 await page.clock.fastForward(11000);await expect(page.getByRole('region',{name:'ภาพหนึ่งเฟรม'})).toContainText('ภาพเก่า')
 for(const[width,height]of[[1440,900],[390,844],[360,480]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.tools/screen-'+width+'.png',fullPage:true})}
 await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ'}).click();await expect(page.getByRole('status')).toContainText('หยุดแชร์แล้ว');await expect(page.getByRole('img')).toHaveCount(0);expect(await page.evaluate(()=>(window as unknown as FixtureWindow).captureTracks.every(t=>t.readyState==='ended'))).toBe(true);expect(network).toEqual([])
})
test('leaving during a pending picker rejects and stops late media',async({page})=>{
 await fixture(page,'pending');await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('รอคุณเลือก')
 await page.getByRole('link',{name:'กลับแชต',exact:true}).click();await page.evaluate(()=>(window as unknown as FixtureWindow).resolveCapture?.());await expect.poll(()=>page.evaluate(()=>(window as unknown as FixtureWindow).captureTracks.every(t=>t.readyState==='ended'))).toBe(true);await expect(page.getByRole('textbox',{name:'ข้อความถึง CIC'})).toBeVisible()
})
test('stop while picker pending clears state and never publishes late stream',async({page})=>{
 await fixture(page,'pending');await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ'}).click();await page.evaluate(()=>(window as unknown as FixtureWindow).resolveCapture?.());await expect.poll(()=>page.evaluate(()=>(window as unknown as FixtureWindow).captureTracks.every(t=>t.readyState==='ended'))).toBe(true);await expect(page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม'})).toBeDisabled()
})
for(const mode of ['denied','monitor'])test('screen '+mode+' fails without retaining media',async({page})=>{
 await fixture(page,mode);await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText(mode==='denied'?'ไม่ได้ให้สิทธิ์':'ไม่แชร์ทั้งจอ');await expect(page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true})).toBeEnabled();expect(await page.evaluate(()=>(window as unknown as FixtureWindow).captureTracks.every(t=>t.readyState==='ended'))).toBe(true)
})
test('source revocation clears snapshot and releases remaining tracks',async({page})=>{
 await fixture(page);await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('กำลังแชร์');await page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม'}).click();await expect(page.getByRole('img')).toBeVisible();await page.evaluate(()=>(window as unknown as FixtureWindow).captureTracks[0].dispatchEvent(new Event('ended')));await expect(page.getByRole('status')).toContainText('หยุดแชร์แล้ว');await expect(page.getByRole('img')).toHaveCount(0)
})
test('public demo cannot open display picker or call local backend',async({page})=>{
 await fixture(page);await page.route('http://screen-demo.test/**',async route=>{const response=await route.fetch({url:route.request().url().replace('http://screen-demo.test','http://127.0.0.1:4173')});await route.fulfill({response})});await page.goto('http://screen-demo.test/CIC-bot/#/screen');await expect(page.getByText('เว็บสาธารณะเป็น demo',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true})).toBeDisabled();expect(await page.evaluate(()=>(window as unknown as FixtureWindow).captureRequests)).toBe(0)
})

test('a frame finishing after video resize is discarded while sharing remains active',async({page})=>{
 await fixture(page)
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob=function(this:HTMLCanvasElement,callback,type,quality){

   ;(window as unknown as {finishSnapshot:()=>void}).finishSnapshot=()=>original.call(this,callback,type,quality)
  }
 })
 await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('กำลังแชร์')
 await page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม'}).click()
 await page.evaluate(()=>{document.querySelector('video')!.dispatchEvent(new Event('resize'));(window as unknown as {finishSnapshot:()=>void}).finishSnapshot()})
 await expect(page.getByRole('img')).toHaveCount(0);await expect(page.getByRole('status')).toContainText('กำลังแชร์')
 await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ'}).click()
})


test('unknown capture surface is rejected without retaining media',async({page})=>{
 await fixture(page,'unknown');await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('ยืนยัน');expect(await page.evaluate(()=>(window as unknown as FixtureWindow).captureTracks.every(t=>t.readyState==='ended'))).toBe(true);
});
test('frame age follows monotonic time despite a backwards wall clock',async({page})=>{
 await fixture(page);await page.clock.install();await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('กำลังแชร์');await page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม'}).click();await expect(page.getByRole('img')).toBeVisible();await page.clock.setSystemTime(new Date('2000-01-01'));await page.clock.fastForward(11000);await expect(page.getByRole('region',{name:'ภาพหนึ่งเฟรม'})).toContainText('ภาพเก่า');await expect(page.getByRole('button',{name:'อ่านเฟรมนี้ด้วย OCR'})).toBeDisabled();await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ'}).click();
});

test('slow snapshot encoding cannot give an old picture a fresh capture timestamp',async({page})=>{
 await fixture(page);await page.clock.install();await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(this:HTMLCanvasElement,callback,type,quality){(window as unknown as {finishSnapshot:()=>void}).finishSnapshot=()=>original.call(this,callback,type,quality)}});
 await page.goto('./#/screen');await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('กำลังแชร์');await page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม'}).click();await page.clock.fastForward(11000);await page.evaluate(()=>(window as unknown as {finishSnapshot:()=>void}).finishSnapshot());await expect(page.getByRole('status')).toContainText('ภาพถ่ายเสร็จช้า');await expect(page.getByRole('img')).toHaveCount(0);await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ'}).click();
});
