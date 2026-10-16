import {appendFileSync} from 'node:fs'
import {join} from 'node:path'
import {record} from '../shared/chatProtocol.js'
const tools=['answer','ask','calculator','time-calculator','clock','ocr','screen','slides','app','research']
const diagnosticStarted=Date.now()
let diagnosticRows=0
export function decisionShape(value:unknown){
 const object=record(value)?value:null,argument=object?.argument
 return {object:!!object,keyCount:object?Object.keys(object).length:null,hasTool:!!object&&Object.hasOwn(object,'tool'),hasArgument:!!object&&Object.hasOwn(object,'argument'),extraKeyCount:object?Object.keys(object).filter(k=>!['tool','argument'].includes(k)).length:null,tool:object&&typeof object.tool==='string'&&tools.includes(object.tool)?object.tool:'unsupported-or-absent',argumentType:typeof argument,argumentChars:typeof argument==='string'?argument.length:null,argumentControlCount:typeof argument==='string'?[...argument].filter(c=>c.charCodeAt(0)<32).length:null}
}
export function modelShape(response:unknown){
 const value=record(response)?response:null,message=record(value?.message)?value.message:null,content=message?.content
 let parsed:unknown,jsonValid=false
 if(typeof content==='string'&&content.length<=4096){try{parsed=JSON.parse(content);jsonValid=true}catch{/* diagnostic only, never repairs content */}}
 const first=typeof content==='string'?content.trimStart():''
 return {terminal:value?.done===true,reason:value?.done_reason==='length'?'length':value?.done_reason==='stop'?'stop':'other-or-absent',toolCallsType:Array.isArray(message?.tool_calls)?'array':typeof message?.tool_calls,toolCallCount:Array.isArray(message?.tool_calls)?message.tool_calls.length:null,contentType:typeof content,contentChars:typeof content==='string'?content.length:null,prefix:first.startsWith('<think>')?'thinking-tag':first.startsWith('```')?'code-fence':first.startsWith('{')?'json-object':first.startsWith('[')?'json-array':first?'other':'empty',thinkingFieldChars:typeof message?.thinking==='string'?message.thinking.length:null,jsonValid,...decisionShape(parsed)}
}
export function shapeDiagnostic(stage:'model'|'parse-ok'|'parse-rejected',shape:ReturnType<typeof modelShape>|ReturnType<typeof decisionShape>){
 if(process.env.CIC_ASSISTANT_SHAPE_DIAGNOSTICS!=='1'||diagnosticRows>=32||Date.now()-diagnosticStarted>300000)return
 diagnosticRows++
 try{appendFileSync(join(process.cwd(),'.tools','assistant-shape-diagnostic.jsonl'),JSON.stringify({at:new Date().toISOString(),stage,shape})+'\n',{encoding:'utf8'})}catch{/* optional metadata must not alter decisions or authority */}
}
