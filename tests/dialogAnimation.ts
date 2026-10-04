import {expect,type Locator} from '@playwright/test'

// Observe the real transition at its event, before host round trips can outlive 260ms.
// Do not pause animations, change durations, disable WebGL or merely assert a CSS declaration.
export async function observeOpeningAnimation(modal:Locator){
 await modal.evaluate(node=>{
  const state:{runs:{property:string;durations:unknown[];opacity:string}[];ends:{property:string;elapsed:number}[];finalOpacity?:string;finalTransform?:string}={runs:[],ends:[]}
  const save=()=>node.setAttribute('data-test-opening-animation',JSON.stringify(state))
  const started=(event:Event)=>{
   const e=event as TransitionEvent
   if(e.target!==node||e.pseudoElement||!node.hasAttribute('open'))return
   state.runs.push({property:e.propertyName,durations:node.getAnimations().map(a=>a.effect!.getTiming().duration),opacity:getComputedStyle(node).opacity});save()
  }
  const ended=(event:Event)=>{
   const e=event as TransitionEvent
   if(e.target!==node||e.pseudoElement||!node.hasAttribute('open'))return
   state.ends.push({property:e.propertyName,elapsed:e.elapsedTime});state.finalOpacity=getComputedStyle(node).opacity;state.finalTransform=getComputedStyle(node).transform;save()
  }
  node.addEventListener('transitionrun',started);node.addEventListener('transitionend',ended);save()
 })
}
export async function expectOpeningAnimation(modal:Locator,timeout=5000){
 await expect.poll(async()=>{
  const data=JSON.parse((await modal.getAttribute('data-test-opening-animation'))!) as {runs:{property:string;durations:number[];opacity:string}[];ends:{property:string;elapsed:number}[];finalOpacity?:string;finalTransform?:string}
  return ['opacity','transform'].every(property=>data.runs.some(run=>run.property===property&&run.durations.some(duration=>duration===260)&&Number(run.opacity)<1)&&data.ends.some(end=>end.property===property&&end.elapsed===0.26))&&data.finalOpacity==='1'&&data.finalTransform==='matrix(1, 0, 0, 1, 0, 0)'
 },{timeout,message:'Real opacity/transform transitions must run for 260ms and reach the open state'}).toBe(true)
}
