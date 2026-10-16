import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
type Case={id:string;index:number;scenario:number;seed:number;partition:string}
type CaptureState={calls:number;tracks:MediaStreamTrack[];options?:DisplayMediaStreamOptions;scenario:number;seed:number}
const dir='validation/2026-10-13-tools-100',mode=process.env.CIC_TOOLS_HOLDOUT==='1'?'holdout':'development',label=process.env.CIC_TOOLS_LABEL??mode
test('100 matrix screen '+mode,async({page,baseURL})=>{
 test.setTimeout(300000)
 const corpus=JSON.parse(await fs.readFile(dir+'/CORPUS.json','utf8')),cases:Case[]=corpus.find((g:{tool:string})=>g.tool==='screen').cases,rows=[]
 await page.addInitScript(()=>{
  const state:CaptureState={calls:0,tracks:[],scenario:0,seed:0};(window as unknown as {matrixCapture:CaptureState}).matrixCapture=state
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async(options:DisplayMediaStreamOptions)=>{
   state.calls++;state.options=options
   if(state.scenario===3)throw new DOMException('Synthetic denied','NotAllowedError')
   const canvas=document.createElement('canvas');canvas.width=320+state.seed%100;canvas.height=200+state.seed%40
   const ctx=canvas.getContext('2d')!;ctx.fillStyle='#123';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='20px sans-serif';ctx.fillStyle='#fff';ctx.fillText('Synthetic case '+state.seed,10,50)
   const stream=canvas.captureStream(10),track=stream.getVideoTracks()[0];state.tracks.push(track)
   Object.defineProperty(track,'getSettings',{configurable:true,value:()=>state.scenario===5?{}:{displaySurface:state.scenario===4?'monitor':state.seed%2?'window':'browser'}})
   return stream
  }})
 })
 const network:string[]=[]
 await page.route(/:8787|:11434/,route=>{network.push(route.request().url());return route.abort()})
 for(const c of cases.filter(c=>c.partition===mode)){
  const began=performance.now();let error:string|undefined
  try{
   await page.goto(baseURL+'?matrix='+c.seed+'#/screen')
   await page.evaluate(c=>{const state=(window as unknown as {matrixCapture:CaptureState}).matrixCapture;state.scenario=c.scenario;state.seed=c.seed},c)
   expect(await page.evaluate(()=>(window as unknown as {matrixCapture:CaptureState}).matrixCapture.calls)).toBe(0)
   await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click()
   if([3,4,5].includes(c.scenario)){
    await expect(page.getByRole('status')).toContainText('ไม่ได้เริ่มแชร์')
    expect(await page.evaluate(()=>(window as unknown as {matrixCapture:CaptureState}).matrixCapture.tracks.every(t=>t.readyState==='ended'))).toBe(true)
   }else{
    await expect(page.getByRole('status')).toContainText('กำลังแชร์')
    expect(await page.evaluate(()=>(window as unknown as {matrixCapture:CaptureState}).matrixCapture.options?.audio)).toBe(false)
    if(c.scenario===1){await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ',exact:true}).click()}
    else if(c.scenario===2){await page.getByRole('link',{name:'กลับแชต',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {matrixCapture:CaptureState}).matrixCapture.tracks.every(t=>t.readyState==='ended')),{timeout:4000}).toBe(true)}
    else{
     await page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม',exact:true}).click()
     await expect(page.getByRole('img',{name:'ภาพหนึ่งเฟรมจากแหล่งที่คุณเลือก',exact:true})).toBeVisible()
     await expect(page.getByRole('region',{name:'ภาพหนึ่งเฟรม',exact:true})).toContainText(String(320+c.seed%100)+'×'+String(200+c.seed%40))
     if(c.scenario===6){await page.evaluate(()=>(window as unknown as {matrixCapture:CaptureState}).matrixCapture.tracks.at(-1)!.dispatchEvent(new Event('ended')));await expect(page.getByRole('img')).toHaveCount(0)}
     else if(c.scenario===7){await page.getByRole('button',{name:'ถ่ายภาพหนึ่งเฟรม',exact:true}).click();await expect(page.getByRole('region',{name:'ภาพหนึ่งเฟรม',exact:true})).toContainText('เฟรม 2')}
     if(c.scenario!==6)await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ',exact:true}).click()
     if(c.scenario===9){await page.getByRole('button',{name:'เลือกหน้าต่างหรือแท็บ',exact:true}).click();await expect(page.getByRole('status')).toContainText('กำลังแชร์');await page.getByRole('button',{name:'หยุดแชร์และล้างภาพ',exact:true}).click();expect(await page.evaluate(()=>(window as unknown as {matrixCapture:CaptureState}).matrixCapture.calls)).toBe(2)}
    }
    expect(await page.evaluate(()=>(window as unknown as {matrixCapture:CaptureState}).matrixCapture.tracks.every(t=>t.readyState==='ended'))).toBe(true)
   }
   expect(network).toEqual([])
  }catch(e){error=e instanceof Error?e.message:String(e)}
  finally{await page.evaluate(()=>{(window as unknown as {matrixCapture?:CaptureState}).matrixCapture?.tracks.forEach(t=>t.stop())}).catch(()=>{});await page.goto('about:blank')}
  rows.push({...c,evidence:'real-browser-synthetic-capture',passed:!error,elapsedMs:performance.now()-began,...(error?{error}:{})})
 }
 await fs.writeFile(dir+'/'+label+'-screen.json',JSON.stringify({tool:'screen',mode,rows,passed:rows.filter(r=>r.passed).length,total:rows.length},null,2),{flag:'wx'})
 expect(rows.filter(r=>!r.passed),'all screen case failures retained').toEqual([])
})
