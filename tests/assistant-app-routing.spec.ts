import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {groundAssistantDecision} from '../backend/assistant'
import {thinkChoice} from '../src/voice/assistantChoice'
const input=(text:string)=>({version:1 as const,operationId:randomUUID(),text,history:[],question:null})
async function proposed(text:string,argument:string){
 const original=globalThis.fetch,i=input(text)
 globalThis.fetch=async()=>new Response(JSON.stringify({version:1,operationId:i.operationId,source:'local-ai-proposal',model:'fixture',elapsedMs:1,decision:{tool:'app',argument}}))
 try{return await thinkChoice('http://fixture.invalid',i,new AbortController().signal)}finally{globalThis.fetch=original}
}
test('app dev: an explicitly named app proposal enters the scoped app plan without asking its name again',async()=>{
 const result=await proposed('ช่วยเตรียม Chrome เพื่อเปิดเว็บให้หน่อย','chrome')
 expect(result.choice).toEqual({kind:'app',instruction:'เปิด Chrome'})
});
test('app dev: model cannot replace the requested Chrome with Notepad',()=>{
 expect(()=>groundAssistantDecision(input('ช่วยเตรียม Chrome เพื่อเปิดเว็บให้หน่อย'),{tool:'app',argument:'notepad'})).toThrow('ungrounded-app')
 expect(groundAssistantDecision(input('ช่วยเตรียม Chrome เพื่อเปิดเว็บให้หน่อย'),{tool:'app',argument:'chrome'})).toEqual({tool:'app',argument:'chrome'})
});
test('app held: an ambiguous two-app request cannot be collapsed into one launch proposal',()=>{
 expect(()=>groundAssistantDecision(input('เปิด Chrome หรือ Notepad ดี'),{tool:'app',argument:'chrome'})).toThrow('ungrounded-app')
});
test('app held: how-to and negative requests keep their answer-only scope',()=>{
 for(const text of ['How do I open Chrome?','อย่าเปิด Chrome'])expect(()=>groundAssistantDecision(input(text),{tool:'app',argument:'chrome'})).toThrow('tool-outside-request')
});
test('app held: client still asks for missing target on a mismatched model proposal',async()=>{
 const result=await proposed('ช่วยเตรียม YouTube เพื่อเปิดเว็บให้หน่อย','chrome')
 expect(result.choice.kind).toBe('clarify')
});
