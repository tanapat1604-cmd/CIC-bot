import {test,expect} from '@playwright/test'
import {modelShape,decisionShape} from '../backend/modelShape'
test('shape metadata omits raw content, reasoning and arbitrary keys',()=>{
 const secret='private synthetic sentinel',shape=modelShape({done:true,done_reason:'stop',message:{content:JSON.stringify({tool:'answer',argument:secret,[secret]:secret}),thinking:secret,tool_calls:[]}})
 expect(shape.jsonValid).toBe(true);expect(shape.extraKeyCount).toBe(1);expect(shape.toolCallCount).toBe(0);expect(JSON.stringify(shape)).not.toContain(secret)
})
test('distinguishes markup, malformed JSON and argument validation metadata without repairing them',()=>{
 expect(modelShape({done:true,message:{content:'<think>private</think>{"tool":"answer"}'}})).toMatchObject({prefix:'thinking-tag',jsonValid:false})
 expect(decisionShape({tool:'answer',argument:'a\r\nb'})).toMatchObject({argumentChars:4,argumentControlCount:2})
 expect(decisionShape({tool:'unknown',argument:''}).tool).toBe('unsupported-or-absent')
})
test('terminal/output limit metadata and absent fields stay explicit',()=>{
 expect(modelShape({done:true,done_reason:'length',message:{content:'{"argument":'}})).toMatchObject({terminal:true,reason:'length',jsonValid:false})
 expect(modelShape(null)).toMatchObject({terminal:false,contentType:'undefined',prefix:'empty',jsonValid:false})
})
