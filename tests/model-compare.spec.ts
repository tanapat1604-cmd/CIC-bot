import {test,expect} from '@playwright/test'
import {localJson} from '../backend/chrome/planner'
const signal=()=>new AbortController().signal
test('larger model needs an explicit comparison flag and enough free memory; arbitrary model remains blocked',async()=>{
 let calls=0;const fetcher=(async()=>{calls++;throw Error('unexpected')}) as typeof fetch
 for(const env of [{AI_PROVIDER:'ollama',AI_MODEL:'qwen3:1.7b'},{AI_PROVIDER:'ollama',AI_MODEL:'arbitrary',CIC_ASSISTANT_COMPARE_MODEL:'1'}])await expect(localJson('test',null,128,signal(),{env,fetcher,freeMiB:()=>4096})).rejects.toThrow('model-not-configured')
 await expect(localJson('test',null,128,signal(),{env:{AI_PROVIDER:'ollama',AI_MODEL:'qwen3:1.7b',CIC_ASSISTANT_COMPARE_MODEL:'1'},fetcher,freeMiB:()=>2000})).rejects.toThrow('model-memory');expect(calls).toBe(0)
})
test('comparison retains model identity, one bounded request and terminal/unload verification',async()=>{
 let chats=0,checks=0;const fetcher=(async(url:unknown,init?:RequestInit)=>{const route=String(url);if(route.endsWith('/api/ps')){checks++;return new Response(JSON.stringify({models:[]}))}if(route.endsWith('/api/show'))return new Response(JSON.stringify({capabilities:['completion']}));const body=JSON.parse(String(init?.body));expect(body.model).toBe('qwen3:1.7b');expect(body.options.num_predict).toBe(128);expect(body.keep_alive).toBe(0);chats++;return new Response(JSON.stringify({done:true,message:{content:'{"tool":"answer","argument":"hello"}'}}))}) as typeof fetch
 await expect(localJson('test',null,128,signal(),{env:{AI_PROVIDER:'ollama',AI_MODEL:'qwen3:1.7b',CIC_ASSISTANT_COMPARE_MODEL:'1'},fetcher,freeMiB:()=>4096})).resolves.toEqual({tool:'answer',argument:'hello'});expect(chats).toBe(1);expect(checks).toBe(2)
})
