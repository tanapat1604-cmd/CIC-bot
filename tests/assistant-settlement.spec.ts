import {test,expect} from '@playwright/test'
import {once} from 'node:events'
import {randomUUID} from 'node:crypto'
import {createChatServer} from '../backend/server'
import {CoreError} from '../shared/core'

test('unverified AI termination remains visible to every session and cannot be cleared by Stop',async()=>{
 let calls=0
 const server=createChatServer({assistantThink:async()=>{calls++;throw new CoreError('model-stop-unverified')}})
 server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:5173'
 const session=async()=>{const r=await fetch(base+'/session',{method:'POST',headers:{Origin}});return{Origin,Cookie:r.headers.get('set-cookie')!.split(';')[0],'Content-Type':'application/json'}}
 const owner=await session(),other=await session()
 const think=(headers:Record<string,string>)=>fetch(base+'/assistant/think',{method:'POST',headers,body:JSON.stringify({version:1,operationId:randomUUID(),text:'ช่วยแนะนำวิธีแบ่งงาน',history:[],question:null})})
 const status=(headers:Record<string,string>)=>fetch(base+'/voice/status',{headers}).then(r=>r.json())
 try{
  expect((await status(owner)).stopUnverified).toBe(false)
  expect(await(await think(owner)).json()).toEqual({code:'model-stop-unverified'})
  for(const headers of [owner,other]){
   const state=await status(headers)
   expect(state.runtimeBusy).toBe(true)
   expect(state.stopUnverified).toBe(true)
   expect(state.assistantStopUnverified).toBe(true)
   for(const endpoint of ['/conversation/pause','/conversation/revoke'])expect((await(await fetch(base+endpoint,{method:'POST',headers,body:'{}'})).json()).settled).toBe(false)
   expect((await status(headers)).stopUnverified).toBe(true)
   expect(await(await think(headers)).json()).toEqual({code:'model-stop-unverified'})
  }
  expect(calls).toBe(1)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})

test('ordinary model failure releases the slot without latching unverified termination',async()=>{
 let calls=0
 const server=createChatServer({assistantThink:async()=>{if(++calls===1)throw new CoreError('model-output-limit');return{tool:'answer',argument:'ทำทีละส่วน'}}})
 server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as {port:number}).port,Origin='http://127.0.0.1:5173'
 const r=await fetch(base+'/session',{method:'POST',headers:{Origin}}),headers={Origin,Cookie:r.headers.get('set-cookie')!.split(';')[0],'Content-Type':'application/json'}
 const think=()=>fetch(base+'/assistant/think',{method:'POST',headers,body:JSON.stringify({version:1,operationId:randomUUID(),text:'ช่วยแบ่งงาน',history:[],question:null})})
 try{
  expect(await(await think()).json()).toEqual({code:'model-output-limit'})
  const state=await(await fetch(base+'/voice/status',{headers})).json()
  expect(state.runtimeBusy).toBe(false);expect(state.stopUnverified).toBe(false);expect(state.assistantStopUnverified).toBe(false)
  expect((await think()).status).toBe(200)
  expect((await(await fetch(base+'/conversation/pause',{method:'POST',headers,body:'{}'})).json()).settled).toBe(true)
  expect(calls).toBe(2)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})
