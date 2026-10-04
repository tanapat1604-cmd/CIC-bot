import {chromium,expect} from '@playwright/test'
import {preview} from 'vite'
import {writeFile,access} from 'node:fs/promises'
// Diagnostic output is append-only: use a fresh path when repeating.
const output=process.argv[2]
if(!output)throw Error('Pass a fresh output path')
try{await access(output);throw Error('Evidence exists')}catch(e){if(e.code!=='ENOENT')throw e}
const server=await preview({preview:{port:4174,host:'127.0.0.1',strictPort:true}})
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']})
const results=[]
try{
 for(const scene of ['normal','offscreen'])for(let round=0;round<2;round++){
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'})
  await page.goto('http://127.0.0.1:4174/CIC-bot/');await expect(page.locator('.scene-hero')).toHaveAttribute('data-renderer','webgl')
  if(scene==='offscreen'){await page.locator('footer').scrollIntoViewIfNeeded();await page.waitForTimeout(150)}
  const modal=page.locator('dialog')
  await modal.evaluate(node=>{
   const frames=[],events=[];globalThis.__dialogAudit={frames,events,opened:null,atLateCheck:null}
   for(const name of ['transitionrun','transitionstart','transitionend'])node.addEventListener(name,event=>{if(event.target===node)events.push({name,property:event.propertyName,elapsedTime:event.elapsedTime,time:performance.now(),pseudo:event.pseudoElement})})
   const observer=new MutationObserver(()=>{
    if(!node.hasAttribute('open'))return
    observer.disconnect();const start=performance.now();globalThis.__dialogAudit.opened=start
   });observer.observe(node,{attributes:true,attributeFilter:['open']})
  })
  const start=performance.now();await page.getByRole('button',{name:'ดาวน์โหลด',exact:true}).first().click();const clickMs=Math.round(performance.now()-start)
  await expect(modal).toHaveAttribute('open','');await expect(modal.locator('.dialog-close')).toBeFocused()
  if(round===1)await page.waitForTimeout(500)
  const late=await modal.evaluate(node=>({sinceOpen:performance.now()-globalThis.__dialogAudit.opened,animations:node.getAnimations().map(a=>({duration:a.effect?.getTiming().duration,state:a.playState})),media:matchMedia('(prefers-reduced-motion: reduce)').matches}))
  await page.waitForTimeout(800);const early=await page.evaluate(()=>globalThis.__dialogAudit)
  results.push({scene,round,clickMs,late,...early});await page.close();console.log(scene,round,'late ms',Math.round(late.sinceOpen),'late260',late.animations.some(a=>a.duration===260),'events',early.events.length)
 }
 await writeFile(output,JSON.stringify({note:'Observer sampling may affect rendering; diagnostics, not replacement assertions. Offscreen variant uses existing visibility pause, without changing duration.',results},null,2))
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
