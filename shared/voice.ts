// General provider contracts remain unaccepted. The bounded local prototype
// below is installed separately; it does not enable hands-free or cloud fallback.
export type VoiceProviderDescriptor={id:string;version:string;mode:'local'|'external-opt-in';languages:readonly string[];artifact:{url:string;sha256:string;bytes:number;license:string}|null;accepted:false}
export type VoiceContext={taskId:string;grantId:string;epoch:number;sequence:number;signal:AbortSignal}
export interface AsrProvider{descriptor:VoiceProviderDescriptor;transcribe(audio:{bytes:Uint8Array;sampleRate:number;durationMs:number},context:VoiceContext):Promise<{text:string;language:string;durationMs:number}>;cancel(taskId:string):Promise<{settled:boolean}>}
export interface TtsProvider{descriptor:VoiceProviderDescriptor;speak(text:string,context:VoiceContext):Promise<{firstAudioMs:number;finished:boolean}>;cancel(taskId:string):Promise<{settled:boolean}>}
export const VOICE_LIMITS=Object.freeze({clipMs:15000,bytes:2000000,reviewBeforeSend:true,halfDuplex:true,onlineFallback:false})

import {CoreError,exact,uuid} from './core.js'
import {record} from './chatProtocol.js'
export const VOICE_PHRASES={sample:'สวัสดีครับ ผมซีไอซี ได้ครับท่าน พร้อมช่วยเปิดเพลงครับ',ack:'ได้ครับท่าน กำลังหาเพลงล่าสุดให้ครับ',opened:'เปิดให้แล้วครับท่าน',failed:'ยังทำไม่สำเร็จครับท่าน กรุณาตรวจข้อความบนหน้าจอ',artist:'ขอชื่อศิลปินให้ชัดอีกครั้งครับท่าน',stopped:'หยุดแล้วครับท่าน',notepadOpened:'เปิดสมุดบันทึกใหม่และตรวจหน้าต่างแล้วครับท่าน',chromeOpened:'เปิดโครมหน้าต่างใหม่และตรวจแล้วครับท่าน',youtubeOpened:'เปิดหน้าเว็บไซต์ยูทูบและตรวจแล้วครับท่าน ยังไม่ได้เล่นคลิป',musicOpened:'ตรวจแล้วว่าเพลงหลักกำลังเล่นครับท่าน',chromeRequested:'ส่งคำขอเปิดโครมแล้วครับ',youtubeRequested:'ส่งคำขอเปิดยูทูบแล้วครับ',clarify:'ยังไม่เข้าใจครับ'} as const
export type VoicePhrase=keyof typeof VOICE_PHRASES
export type VoiceRequest={version:1;operationId:string;acknowledged:true}&({kind:'asr';pcm:string;language?:'th'|'auto'}|{kind:'tts';phrase:VoicePhrase})
export function parseVoiceRequest(v:unknown):VoiceRequest{
 if(!record(v)||v.version!==1||!uuid(v.operationId)||v.acknowledged!==true)throw new CoreError('permission-denied')
 if(v.kind==='tts'&&exact(v,['version','operationId','acknowledged','kind','phrase'])&&typeof v.phrase==='string'&&Object.hasOwn(VOICE_PHRASES,v.phrase))return v as VoiceRequest
 if(v.kind==='asr'&&(exact(v,['version','operationId','acknowledged','kind','pcm'])||exact(v,['version','operationId','acknowledged','kind','pcm','language']))&&(v.language===undefined||v.language==='th'||v.language==='auto')&&typeof v.pcm==='string'&&v.pcm.length>=10668&&v.pcm.length<=640000&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.pcm))return v as VoiceRequest
 throw new CoreError('invalid-audio')
}
export type VoiceJob={version:1;taskId:string;operationId:string;kind:'asr'|'tts';state:'queued'|'running'|'succeeded'|'failed'|'cancelling'|'cancelled'|'stop-unverified';reason?:string;result?:{asrModel?:string;asrDecodeProfile?:'legacy'|'thai-command-v1';workerHash?:string;text?:string;language?:'th'|'en';phrase?:VoicePhrase;audioBytes?:number;cacheHit?:boolean;elapsedMs:number;peakWorkingSetMiB:number|null}}
export function parseVoiceJob(v:unknown):VoiceJob{
 if(!record(v)||v.version!==1||!uuid(v.taskId)||!uuid(v.operationId)||!['asr','tts'].includes(String(v.kind))||!['queued','running','succeeded','failed','cancelling','cancelled','stop-unverified'].includes(String(v.state)))throw new CoreError('protocol')
 if(v.reason!==undefined&&(typeof v.reason!=='string'||v.reason.length>100))throw new CoreError('protocol')
 if(v.result){const r=v.result;if(!record(r)||v.state!=='succeeded'||typeof r.elapsedMs!=='number'||!Number.isFinite(r.elapsedMs)||r.elapsedMs<0||r.peakWorkingSetMiB!==null&&(typeof r.peakWorkingSetMiB!=='number'||!Number.isFinite(r.peakWorkingSetMiB)||r.peakWorkingSetMiB<0))throw new CoreError('protocol');if(v.kind==='asr'&&(typeof r.text!=='string'||!r.text.trim()||r.text.length>200||!['th','en'].includes(String(r.language)))||v.kind==='tts'&&(typeof r.phrase!=='string'||!Object.hasOwn(VOICE_PHRASES,r.phrase)||typeof r.audioBytes!=='number'||r.audioBytes<44||r.audioBytes>2000000))throw new CoreError('protocol')}
 if(record(v.result)&&v.result.cacheHit!==undefined&&(v.kind!=='tts'||typeof v.result.cacheHit!=='boolean'))throw new CoreError('protocol')
 if(record(v.result)&&(v.result.asrModel!==undefined&&(v.kind!=='asr'||!['faster-whisper-base-cpu-int8','faster-whisper-small-cpu-int8','distill-whisper-th-small-cpu-int8'].includes(String(v.result.asrModel)))||v.result.asrDecodeProfile!==undefined&&(v.kind!=='asr'||!['legacy','thai-command-v1'].includes(String(v.result.asrDecodeProfile)))||v.result.workerHash!==undefined&&(v.kind!=='asr'||typeof v.result.workerHash!=='string'||!/^[a-f0-9]{64}$/.test(v.result.workerHash))))throw new CoreError('protocol')
 if(v.state==='succeeded'&&!v.result)throw new CoreError('protocol')
 return v as VoiceJob
}
