import {freemem} from 'node:os'
import {CoreError} from '../../shared/core.js'
import {record} from '../../shared/chatProtocol.js'
import {parseMusicIntent,requireMusicRequest,requireNamedArtist,type MusicIntent} from '../../shared/youtube.js'
import {createOllamaProvider,ollamaConfig} from '../ollama.js'
export const MUSIC_PLAN_SYSTEM='Extract the artist from a music request. Return only JSON with artist and latest. Copy the artist name from the request, without translating. In Thai the artist may directly follow เปิดเพลง without spaces. Remove request words เปิดเพลง, ของ, ล่าสุด, ให้หน่อย, ให้ฟัง. latest=true for ล่าสุด, ใหม่ที่สุด, latest or newest. Example: เปิดเพลงคาราบาวล่าสุดให้หน่อย -> {"artist":"คาราบาว","latest":true}. Example: Play music by Adele -> {"artist":"Adele","latest":false}. Do not invent song titles or URLs. For non-music requests or no named artist return {"artist":"","latest":false}.'
export async function planMusic(instruction:string,signal:AbortSignal,onRaw:(raw:string)=>void,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch,freeMiB=()=>freemem()/1048576){
 if(env.AI_PROVIDER!=='ollama')throw new CoreError('model-not-configured')
 const config=ollamaConfig(env)
 if(config.model!=='qwen3:0.6b')throw new CoreError('unsupported-planner-model')
 requireMusicRequest(instruction)
 const available=freeMiB();if(!Number.isFinite(available)||available<1152)throw new CoreError('model-memory')
 const call=async(path:string,body?:unknown,timeoutMs=45000)=>{const r=await fetcher(config.baseUrl+path,{method:body===undefined?'GET':'POST',redirect:'error',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(timeoutMs)});if(!r.ok){await r.body?.cancel();throw new CoreError('model-unavailable')}if(!r.body)throw new CoreError('model-unavailable');const reader=r.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let raw='',bytes=0;try{while(true){const chunk=await reader.read();if(chunk.done){raw+=decoder.decode();break}bytes+=chunk.value.length;if(bytes>65536)throw new CoreError('model-output-limit');raw+=decoder.decode(chunk.value,{stream:true})}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}return JSON.parse(raw) as unknown}
 const resident=await call('/api/ps',undefined,2000);if(!record(resident)||!Array.isArray(resident.models)||resident.models.length)throw new CoreError('model-busy')
 await createOllamaProvider(config,fetcher).check!(AbortSignal.timeout(8000));signal.throwIfAborted()
 let settled=false,terminal=false,planned:MusicIntent|undefined,failure:unknown
 try{
  // Do not race abort against execution: retain the scheduler slot until Ollama settles.
  const response=await call('/api/chat',{model:config.model,stream:false,think:false,keep_alive:0,truncate:false,shift:false,format:{type:'object',additionalProperties:false,properties:{artist:{type:'string'},latest:{type:'boolean'}},required:['artist','latest']},options:{num_ctx:config.context,num_predict:config.output,num_thread:config.threads,temperature:0,seed:42},messages:[{role:'system',content:MUSIC_PLAN_SYSTEM},{role:'user',content:instruction}]})
  terminal=record(response)&&response.done===true&&!response.error
  if(!terminal||!record(response)||response.done_reason==='length'||!record(response.message)||typeof response.message.content!=='string'||response.message.content.length>4096||response.message.tool_calls)throw new CoreError('invalid-model-plan')
  onRaw(response.message.content);signal.throwIfAborted()
  const intent=parseMusicIntent(JSON.parse(response.message.content))
  requireNamedArtist(intent,instruction)
  if(/ล่าสุด|ใหม่ที่สุด|latest|newest/i.test(instruction)!==intent.latest)throw new CoreError('invalid-model-plan')
  planned=intent
 }catch(e){failure=e}
  // keep_alive=0 requests release. Verify actual residency before reporting cleanup.
 const cleanupDeadline=performance.now()+5000
 try{while(performance.now()<cleanupDeadline){const ps=await call('/api/ps',undefined,Math.min(2000,Math.max(1,Math.floor(cleanupDeadline-performance.now()))));if(record(ps)&&Array.isArray(ps.models)&&ps.models.length===0){settled=true;break}await new Promise(r=>setTimeout(r,250))}}catch{throw new CoreError('model-stop-unverified')}
 // An empty ps alone cannot prove a timed-out/queued request has terminated.
 if(!settled||!terminal)throw new CoreError('model-stop-unverified')
 if(failure)throw failure
 if(!planned)throw new CoreError('invalid-model-plan')
 return{intent:planned,model:config.model}
}
