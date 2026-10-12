import {spawn} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {StringDecoder} from 'node:string_decoder'
import {CoreError} from '../../shared/core.js'
import type {VoiceRequest} from '../../shared/voice.js'
import {FixedSpeechCache} from './fixedSpeechCache.js'
const fixedSpeech=new FixedSpeechCache()
export type VoiceConfig={asrDecodeProfile?:'legacy'|'thai-command-v1';asrContext?:'none'|'apps';asrModel?:'faster-whisper-base-cpu-int8'|'faster-whisper-small-cpu-int8'|'distill-whisper-th-small-cpu-int8';python:string;worker:string;workerHash:string;tts:string;asr:string;files:{path:string;sha256:string}[]}
export function readVoiceConfig():VoiceConfig|null{try{const v=JSON.parse(fs.readFileSync(path.resolve('.tools/voice-config.json'),'utf8')) as VoiceConfig;if(v.asrContext!==undefined&&!['none','apps'].includes(v.asrContext))return null;if(v.asrModel!==undefined&&!['faster-whisper-base-cpu-int8','faster-whisper-small-cpu-int8','distill-whisper-th-small-cpu-int8'].includes(v.asrModel))return null;if(v.asrDecodeProfile!==undefined&&!['legacy','thai-command-v1'].includes(v.asrDecodeProfile))return null;if(v.asrDecodeProfile==='thai-command-v1'&&(v.asrModel!=='distill-whisper-th-small-cpu-int8'||v.asrContext==='apps'))return null;if(![v.python,v.worker,v.tts,v.asr].every(p=>typeof p==='string'&&path.isAbsolute(p)&&fs.existsSync(p))||!Array.isArray(v.files)||v.files.length<4||!/^[a-f0-9]{64}$/.test(v.workerHash))return null;return v}catch{return null}}
export type SpeechOutput={kind:'asr'|'tts';text?:string;language?:'th'|'en';phrase?:string;wav?:Buffer;elapsedMs:number;peakWorkingSetMiB:number|null;cacheHit?:boolean}
export function speechIntegrityFiles(kind:VoiceRequest['kind'],config:VoiceConfig){
 const inside=(file:string,dir:string)=>{const relative=path.relative(path.resolve(dir),path.resolve(file));return relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)}
 const active=kind==='tts'?path.dirname(config.tts):config.asr,other=kind==='tts'?config.asr:path.dirname(config.tts)
 // Only omit files exclusive to the unused model; unknown/shared dependencies
 // and the worker retain their checks. ASR is never bypassed by a TTS cache hit.
 return config.files.filter(f=>inside(f.path,active)||!inside(f.path,other))
}
export async function runSpeech(input:VoiceRequest,signal:AbortSignal,config:VoiceConfig):Promise<SpeechOutput>{
 const began=performance.now();signal.throwIfAborted()
 const integrityFiles=speechIntegrityFiles(input.kind,config)
 for(const f of [...integrityFiles,{path:config.worker,sha256:config.workerHash}]){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(f.path))hash.update(chunk);if(hash.digest('hex')!==f.sha256)throw new CoreError('voice-integrity');signal.throwIfAborted()}
 const cacheKey=input.kind==='tts'?JSON.stringify([config.workerHash,config.tts,integrityFiles,input.phrase]):null
 // Verify model/worker hashes even on a hit. Cache cannot bypass integrity or Stop.
 if(cacheKey){const cached=fixedSpeech.get(cacheKey);signal.throwIfAborted();if(cached)return {...cached,elapsedMs:Math.round(performance.now()-began),peakWorkingSetMiB:null,cacheHit:true}}
 const sysroot=process.env.SystemRoot??'C:\\Windows',child=spawn(config.python,[config.worker,input.kind==='tts'?config.tts:config.asr],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{SystemRoot:sysroot,WINDIR:sysroot,PATH:path.dirname(config.python)+';'+path.join(sysroot,'System32'),TEMP:process.env.TEMP,TMP:process.env.TMP,PYTHONUTF8:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',OMP_NUM_THREADS:'3',OPENBLAS_NUM_THREADS:'3'}})
 return await new Promise<SpeechOutput>((resolve,reject)=>{
  let bytes=0,stderrBytes=0,output='',failed:Error|undefined,killTimer:ReturnType<typeof setTimeout>|undefined,finished=false;const decoder=new StringDecoder('utf8')
  const end=(error?:Error,value?:SpeechOutput)=>{if(finished)return;finished=true;clearTimeout(timeout);if(killTimer)clearTimeout(killTimer);signal.removeEventListener('abort',abort);if(error)reject(error);else resolve(value!)}
  const abort=()=>{failed??=new CoreError('cancelled');child.kill();killTimer??=setTimeout(()=>end(new CoreError('voice-stop-unverified')),5000);killTimer.unref()}
  const timeout=setTimeout(()=>{failed=new CoreError('timeout');abort()},90000);timeout.unref();signal.addEventListener('abort',abort,{once:true})
  child.stdout.on('data',(b:Buffer)=>{bytes+=b.length;if(bytes>3000000){failed=new CoreError('voice-output-limit');abort()}else output+=decoder.write(b)})
  child.stderr.on('data',(b:Buffer)=>{stderrBytes+=b.length;if(stderrBytes>16384){failed=new CoreError('voice-output-limit');abort()}})
  child.once('error',()=>{if(child.pid){failed=new CoreError('voice-stop-unverified');abort()}else end(new CoreError('voice-runtime-unavailable'))})
  child.stdin.on('error',()=>{/* close/exit is authoritative */})
  child.once('close',code=>{if(failed||signal.aborted){end(failed??new CoreError('cancelled'));return}try{const r=JSON.parse(output);if(r.version!==1||r.ok!==true||code!==0)throw new CoreError(['no-speech','transcript-limit','uncertain-speech'].includes(r.code)?r.code:'voice-runtime-failed');if(r.kind!==input.kind||typeof r.elapsedMs!=='number'||!Number.isFinite(r.elapsedMs)||r.elapsedMs<0||r.peakWorkingSetMiB!==null&&(typeof r.peakWorkingSetMiB!=='number'||!Number.isFinite(r.peakWorkingSetMiB)||r.peakWorkingSetMiB<0))throw new CoreError('protocol');const result:SpeechOutput={kind:r.kind,elapsedMs:r.elapsedMs,peakWorkingSetMiB:r.peakWorkingSetMiB};if(input.kind==='asr'){if(typeof r.text!=='string'||!r.text.trim()||r.text.length>200||!['th','en'].includes(r.language))throw new CoreError('protocol');result.text=r.text;result.language=r.language}else{if(r.phrase!==input.phrase||typeof r.wav!=='string'||r.wav.length>2700000)throw new CoreError('protocol');const wav=Buffer.from(r.wav,'base64');if(wav.length<44||wav.length>2000000||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE'||wav.readUInt32LE(4)!==wav.length-8||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==22050||wav.readUInt16LE(34)!==16)throw new CoreError('protocol');result.wav=wav;result.phrase=input.phrase}if(cacheKey&&result.kind==='tts'){fixedSpeech.put(cacheKey,result);result.cacheHit=false}end(undefined,result)}catch(e){end(e instanceof CoreError?e:new CoreError('protocol'))}})
  child.stdin.end(JSON.stringify(input.kind==='tts'?{kind:'tts',phrase:input.phrase}:{kind:'asr',pcm:input.pcm,language:input.language??'th',...(config.asrContext==='apps'?{context:'apps'}:{}),...(config.asrDecodeProfile?{decodeProfile:config.asrDecodeProfile}:{})}))
  if(signal.aborted)abort()
 })
}
