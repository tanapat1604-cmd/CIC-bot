import {ReplySpeechSession} from './replySession.js'
import {spawn} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {StringDecoder} from 'node:string_decoder'
import {CoreError} from '../../shared/core.js'
import type {SpeechTimings,VoiceRequest} from '../../shared/voice.js'
import {FixedSpeechDisk} from './fixedSpeechDisk.js'
import {FixedSpeechCache} from './fixedSpeechCache.js'
const fixedSpeech=new FixedSpeechCache(),fixedSpeechDisk=new FixedSpeechDisk()
export type VoiceConfig={asrMinimumActivityMs?:180|250;asrCpuThreads?:2|3|4;fixedTtsCache?:boolean;asrDecodeProfile?:'legacy'|'thai-command-v1'|'thai-window6-v1'|'thai-window6-beam3-v1'|'thai-window12-v1'|'ctc-greedy-v1'|'ctc-prefix-beam8-v1';asrContext?:'none'|'apps';asrModel?:'faster-whisper-base-cpu-int8'|'faster-whisper-small-cpu-int8'|'distill-whisper-th-small-cpu-int8'|'whisper-th-small-combined-cpu-int8'|'wav2vec2-thai-cpu-int8';python:string;worker:string;workerHash:string;tts:string;asr:string;files:{path:string;sha256:string}[]}
export function readVoiceConfig():VoiceConfig|null{try{const v=JSON.parse(fs.readFileSync(path.resolve('.tools/voice-config.json'),'utf8')) as VoiceConfig;if(v.asrModel==='faster-whisper-small-cpu-int8'&&v.asrDecodeProfile?.startsWith('thai-window')&&(process.env.CIC_ASR_MULTILINGUAL_COMPARE!=='1'||v.asrDecodeProfile!=='thai-window6-v1'||v.asrContext==='apps'))return null;if(v.asrModel==='whisper-th-small-combined-cpu-int8'&&(process.env.CIC_ASR_TEACHER_COMPARE!=='1'||v.asrDecodeProfile!=='thai-window6-v1'||v.asrContext==='apps'))return null;if((v.asrModel==='wav2vec2-thai-cpu-int8'||v.asrDecodeProfile==='ctc-greedy-v1'||v.asrDecodeProfile==='ctc-prefix-beam8-v1')&&(process.env.CIC_ASR_CTC_COMPARE!=='1'||v.asrModel!=='wav2vec2-thai-cpu-int8'||!['ctc-greedy-v1','ctc-prefix-beam8-v1'].includes(v.asrDecodeProfile??'')||v.asrContext==='apps'))return null;if((v.asrDecodeProfile==='thai-window6-v1'||v.asrDecodeProfile==='thai-window6-beam3-v1'||v.asrDecodeProfile==='thai-window12-v1')&&(process.env.CIC_ASR_WINDOW_COMPARE!=='1'||!['distill-whisper-th-small-cpu-int8','whisper-th-small-combined-cpu-int8','faster-whisper-small-cpu-int8'].includes(v.asrModel??'')||v.asrContext==='apps'))return null;if(v.asrMinimumActivityMs!==undefined&&![180,250].includes(v.asrMinimumActivityMs)||v.asrMinimumActivityMs===180&&process.env.CIC_ASR_SHORT_WORD_COMPARE!=='1')return null;if(v.asrCpuThreads!==undefined&&![2,3,4].includes(v.asrCpuThreads))return null;if(v.fixedTtsCache!==undefined&&typeof v.fixedTtsCache!=='boolean')return null;if(v.asrContext!==undefined&&!['none','apps'].includes(v.asrContext))return null;if(v.asrModel!==undefined&&!['faster-whisper-base-cpu-int8','faster-whisper-small-cpu-int8','distill-whisper-th-small-cpu-int8','whisper-th-small-combined-cpu-int8','wav2vec2-thai-cpu-int8'].includes(v.asrModel))return null;if(v.asrDecodeProfile!==undefined&&!['legacy','thai-command-v1','thai-window6-v1','thai-window6-beam3-v1','thai-window12-v1','ctc-greedy-v1','ctc-prefix-beam8-v1'].includes(v.asrDecodeProfile))return null;if(v.asrDecodeProfile==='thai-command-v1'&&(v.asrModel!=='distill-whisper-th-small-cpu-int8'||v.asrContext==='apps'))return null;if(![v.python,v.worker,v.tts,v.asr].every(p=>typeof p==='string'&&path.isAbsolute(p)&&fs.existsSync(p))||!Array.isArray(v.files)||v.files.length<4||!/^[a-f0-9]{64}$/.test(v.workerHash))return null;return v}catch{return null}}
export type SpeechOutput={kind:'asr'|'tts';text?:string;language?:'th'|'en';phrase?:string;wav?:Buffer;elapsedMs:number;peakWorkingSetMiB:number|null;cacheHit?:boolean;timings?:SpeechTimings}
export function speechIntegrityFiles(kind:VoiceRequest['kind'],config:VoiceConfig){
 const inside=(file:string,dir:string)=>{const relative=path.relative(path.resolve(dir),path.resolve(file));return relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)}
 const active=kind==='tts'?path.dirname(config.tts):config.asr,other=kind==='tts'?config.asr:path.dirname(config.tts)
 // Only omit files exclusive to the unused model; unknown/shared dependencies
 // and the worker retain their checks. ASR is never bypassed by a TTS cache hit.
 return config.files.filter(f=>inside(f.path,active)||!inside(f.path,other))
}

const workerEnv=(config:VoiceConfig)=>{const sysroot=process.env.SystemRoot??'C:\\Windows';return {SystemRoot:sysroot,WINDIR:sysroot,PATH:path.dirname(process.execPath)+';'+path.join(sysroot,'System32'),TEMP:process.env.TEMP,TMP:process.env.TMP,CIC_ASR_CPU_THREADS:String(config.asrCpuThreads??3),PYTHONUTF8:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',OMP_NUM_THREADS:'3',OPENBLAS_NUM_THREADS:'3'}}
const replySpeechSession=new ReplySpeechSession(parseOutput,config=>({...workerEnv(config),PATH:path.dirname(config.python)+';'+path.join(process.env.SystemRoot??'C:\\Windows','System32')}))
export const replySpeechOwner=()=>replySpeechSession.owner()
export const replySpeechHeld=()=>replySpeechSession.held()
export const replySpeechFault=()=>replySpeechSession.fault()
export const assertReplySpeechOwner=(owner:string)=>replySpeechSession.assertOwner(owner)
export const stopReplySpeech=(owner:string)=>replySpeechSession.stop(owner)
export const closeReplySpeech=()=>replySpeechSession.close()
export async function verifySpeech(kind:VoiceRequest['kind'],signal:AbortSignal,config:VoiceConfig){
 const began=performance.now();signal.throwIfAborted();const files=speechIntegrityFiles(kind,config)
 for(const f of [...files,{path:config.worker,sha256:config.workerHash}]){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(f.path)){signal.throwIfAborted();hash.update(chunk)}if(hash.digest('hex')!==f.sha256)throw new CoreError('voice-integrity');signal.throwIfAborted()}
 return {files,integrityMs:Math.round(performance.now()-began)}
}
function workerTimings(value:unknown):Pick<SpeechTimings,'importMs'|'modelLoadMs'|'decodeMs'|'inputWaitMs'>|undefined{
 if(value===undefined)return undefined
 if(!value||typeof value!=='object')throw new CoreError('protocol')
 const result=value as Record<string,unknown>;for(const key of ['importMs','modelLoadMs','decodeMs','inputWaitMs'])if(typeof result[key]!=='number'||!Number.isFinite(result[key])||Number(result[key])<0||Number(result[key])>180000)throw new CoreError('protocol')
 return {importMs:Number(result.importMs),modelLoadMs:Number(result.modelLoadMs),decodeMs:Number(result.decodeMs),inputWaitMs:Number(result.inputWaitMs)}
}
export function speechFailureTimings(error:unknown):SpeechTimings|undefined{return error instanceof CoreError?(error as CoreError&{timings?:SpeechTimings}).timings:undefined}
function parseOutput(output:string,code:number|null,input:VoiceRequest):SpeechOutput{const r=JSON.parse(output);if(r.version!==1||r.ok!==true||code!==0){const error=new CoreError(['no-speech','transcript-limit','uncertain-speech'].includes(r.code)?r.code:'voice-runtime-failed') as CoreError&{timings?:SpeechTimings};error.timings=input.kind==='asr'?workerTimings(r.timings):undefined;throw error;}if(r.kind!==input.kind||typeof r.elapsedMs!=='number'||!Number.isFinite(r.elapsedMs)||r.elapsedMs<0||r.peakWorkingSetMiB!==null&&(typeof r.peakWorkingSetMiB!=='number'||!Number.isFinite(r.peakWorkingSetMiB)||r.peakWorkingSetMiB<0))throw new CoreError('protocol');const result:SpeechOutput={kind:r.kind,elapsedMs:r.elapsedMs,peakWorkingSetMiB:r.peakWorkingSetMiB};if(input.kind==='asr'){if(typeof r.text!=='string'||!r.text.trim()||r.text.length>200||!['th','en'].includes(r.language))throw new CoreError('protocol');result.text=r.text;result.language=r.language}else{if((input.phrase!==undefined?r.phrase!==input.phrase||r.text!==undefined:r.text!==input.text||r.phrase!==undefined)||typeof r.wav!=='string'||r.wav.length>2700000)throw new CoreError('protocol');const wav=Buffer.from(r.wav,'base64');if(wav.length<44||wav.length>2000000||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE'||wav.readUInt32LE(4)!==wav.length-8||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==22050||wav.readUInt16LE(34)!==16)throw new CoreError('protocol');result.wav=wav;if(input.phrase!==undefined)result.phrase=input.phrase;else result.text=input.text}
 result.timings=r.kind==='asr'||input.kind==='tts'&&input.text!==undefined?workerTimings(r.timings):undefined;return result
}
export type OwnedSpeechWorker={ready:Promise<void>;exited:Promise<void>;submit:(input:VoiceRequest)=>Promise<SpeechOutput>;stop:()=>Promise<void>}
function ownedWorker(kind:VoiceRequest['kind'],signal:AbortSignal,config:VoiceConfig,prepared:boolean,integrityMs:number,began:number):OwnedSpeechWorker{
 signal.throwIfAborted();const spawned=performance.now(),env=workerEnv(config);env.PATH=path.dirname(config.python)+';'+path.join(process.env.SystemRoot??'C:\\Windows','System32')
 const script=config.worker.endsWith('reply-sapi.ps1')?fs.readFileSync(config.worker,'utf8'):null
 if(script&&createHash('sha256').update(script).digest('hex')!==config.workerHash)throw new CoreError('voice-integrity')
 const child=spawn(config.python,script?['-NoProfile','-NonInteractive','-Command',script]:[config.worker,kind==='tts'?config.tts:config.asr,...(prepared?['--prepare']:[])],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env})
 let readyResolve:()=>void=()=>{},readyReject:(e:Error)=>void=()=>{},exitResolve:()=>void=()=>{},resultResolve:(r:SpeechOutput)=>void=()=>{},resultReject:(e:Error)=>void=()=>{}
 const ready=new Promise<void>((yes,no)=>{readyResolve=yes;readyReject=no}),exited=new Promise<void>(yes=>exitResolve=yes),result=new Promise<SpeechOutput>((yes,no)=>{resultResolve=yes;resultReject=no});void ready.catch(()=>{});void result.catch(()=>{})
 let killTimer:ReturnType<typeof setTimeout>|undefined;let bytes=0,stderrBytes=0,output='',failed:Error|undefined,request:VoiceRequest|undefined,finished=false,readySeen=!prepared,startupMs=0
 const decoder=new StringDecoder('utf8'),timeout=setTimeout(()=>{failed=new CoreError('timeout');abort()},90000);timeout.unref()
 const abort=()=>{failed??=new CoreError('cancelled');child.kill();killTimer??=setTimeout(()=>{const e=new CoreError('voice-stop-unverified');readyReject(e);resultReject(e)},5000);killTimer.unref()}
 const finish=(code:number|null)=>{if(finished)return;finished=true;clearTimeout(timeout);if(killTimer)clearTimeout(killTimer);signal.removeEventListener('abort',abort);exitResolve();if(!readySeen)readyReject(failed??new CoreError('voice-runtime-failed'));if(failed||signal.aborted){resultReject(failed??new CoreError('cancelled'));return}try{if(!request)throw new CoreError('voice-runtime-failed');const parsed=parseOutput(output,code,request);parsed.timings={...parsed.timings,integrityMs,startupMs,workerWallMs:Math.round(performance.now()-spawned),backendWallMs:Math.round(performance.now()-began)};resultResolve(parsed)}catch(e){const error=e instanceof CoreError?e:new CoreError('protocol');Object.assign(error,{timings:{...speechFailureTimings(error),integrityMs,startupMs,workerWallMs:Math.round(performance.now()-spawned),backendWallMs:Math.round(performance.now()-began)}});resultReject(error)}}
 signal.addEventListener('abort',abort,{once:true})
 child.once('spawn',()=>{startupMs=Math.round(performance.now()-spawned);if(!prepared)readyResolve()})
 child.stdout.on('data',(b:Buffer)=>{bytes+=b.length;if(bytes>3000000){failed=new CoreError('voice-output-limit');abort();return}output+=decoder.write(b);if(prepared&&!readySeen&&output.includes('\n')){const split=output.indexOf('\n'),line=output.slice(0,split);output=output.slice(split+1);try{const r=JSON.parse(line);if(r.version!==1||r.ready!==true)throw new CoreError('voice-runtime-failed');workerTimings(r.timings);readySeen=true;readyResolve()}catch(e){failed=e instanceof CoreError?e:new CoreError('protocol');abort()}}})
 child.stderr.on('data',(b:Buffer)=>{stderrBytes+=b.length;if(stderrBytes>16384){failed=new CoreError('voice-output-limit');abort()}})
 child.once('error',()=>{failed=new CoreError('voice-runtime-unavailable');if(child.pid)abort();else finish(null)})
 child.stdin.on('error',()=>{/* Close is the authoritative process exit. */})
 child.once('close',code=>{output+=decoder.end();finish(code)})
 if(signal.aborted)abort()
 return{ready,exited,submit(input){if(request||finished||signal.aborted)throw new CoreError('replay');if(input.kind!==kind)throw new CoreError('invalid');request=input;child.stdin.end(JSON.stringify(input.kind==='tts'?(input.phrase!==undefined?{kind:'tts',phrase:input.phrase}:{kind:'tts',text:input.text}):{kind:'asr',pcm:input.pcm,language:input.language??'th',...(config.asrContext==='apps'?{context:'apps'}:{}),...(config.asrDecodeProfile?{decodeProfile:config.asrDecodeProfile}:{}),...(config.asrMinimumActivityMs?{minimumActivityMs:config.asrMinimumActivityMs}:{})}));return result},async stop(){if(finished)return;abort();let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([exited,new Promise<void>((_,reject)=>{timer=setTimeout(()=>reject(new CoreError('voice-stop-unverified')),5000);timer.unref()})])}finally{if(timer)clearTimeout(timer)}}}
}
export async function prepareAsr(signal:AbortSignal,config:VoiceConfig):Promise<OwnedSpeechWorker>{const began=performance.now(),verified=await verifySpeech('asr',signal,config);return ownedWorker('asr',signal,config,true,verified.integrityMs,began)}
export async function runSpeech(input:VoiceRequest,signal:AbortSignal,config:VoiceConfig,owner?:string):Promise<SpeechOutput>{
 if(input.kind==='tts'&&input.text!==undefined){
  if(/[a-z]/iu.test(input.text)&&!/[\u0e00-\u0e7f]/u.test(input.text))config={...config,files:systemReplyIntegrityFiles(config),python:path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),worker:path.resolve('backend/voice/reply-sapi.ps1'),workerHash:'ee68f232b3b2bfc0f24fd63337a41fe5e9fb667bfd941a5cb92086b04410b7d7'}
  else if(owner)config={...config,worker:path.resolve('backend/voice/reply-session-worker.py'),workerHash:'29cc99cf5d1bbd289411a4d4bb542f546c0f760c90893e953097df479444b56d'}
  else config={...config,worker:path.resolve('backend/voice/reply-worker.py'),workerHash:'abe2d95d85abf9673b3a60272e71f4d4c6585f6db7fed8b238281edc07b87f73'}
 }
 const began=performance.now(),{files,integrityMs}=await verifySpeech(input.kind,signal,config),cacheKey=input.kind==='tts'&&input.phrase!==undefined?JSON.stringify([config.workerHash,config.tts,files,input.phrase]):null
 if(cacheKey){const cached=fixedSpeech.get(cacheKey)??(config.fixedTtsCache===true?await fixedSpeechDisk.get(cacheKey,input.kind==='tts'?input.phrase??'':''):undefined);signal.throwIfAborted();if(cached)return{...cached,elapsedMs:Math.round(performance.now()-began),peakWorkingSetMiB:null,cacheHit:true,timings:{integrityMs,backendWallMs:Math.round(performance.now()-began)}}}
 if(owner&&input.kind==='tts'&&input.text!==undefined&&config.worker.endsWith('reply-session-worker.py')){const value=await replySpeechSession.submit(owner,input,signal,config);value.timings={...value.timings,integrityMs,backendWallMs:Math.round(performance.now()-began)};return value}
 const worker=ownedWorker(input.kind,signal,config,false,integrityMs,began)
 const aborted=()=>{void worker.stop().catch(()=>{})};signal.addEventListener('abort',aborted,{once:true})
 try{let stopTimer:ReturnType<typeof setTimeout>|undefined;const unverified=new Promise<never>((_,reject)=>{const stop=()=>{stopTimer=setTimeout(()=>reject(new CoreError('voice-stop-unverified')),5000);stopTimer.unref()};signal.addEventListener('abort',stop,{once:true});void worker.exited.then(()=>{signal.removeEventListener('abort',stop);if(stopTimer)clearTimeout(stopTimer)})});const value=await Promise.race([worker.submit(input),unverified]);if(cacheKey){fixedSpeech.put(cacheKey,value);if(config.fixedTtsCache===true)await fixedSpeechDisk.put(cacheKey,value);signal.throwIfAborted();value.cacheHit=false}return value}finally{signal.removeEventListener('abort',aborted)}
}

// The installed Windows voice never reads either repo voice model. Keep all
// unknown/shared checks; only omit assets exclusive to these unused models.
export function systemReplyIntegrityFiles(config:VoiceConfig){
 const inside=(file:string,dir:string)=>{const relative=path.relative(path.resolve(dir),path.resolve(file));return relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)}
 return config.files.filter(f=>!inside(f.path,config.asr)&&!inside(f.path,path.dirname(config.tts)))
}
