// Contracts only: there is no installed/accepted speech adapter or automatic cloud fallback.
export type VoiceProviderDescriptor={id:string;version:string;mode:'local'|'external-opt-in';languages:readonly string[];artifact:{url:string;sha256:string;bytes:number;license:string}|null;accepted:false}
export type VoiceContext={taskId:string;grantId:string;epoch:number;sequence:number;signal:AbortSignal}
export interface AsrProvider{descriptor:VoiceProviderDescriptor;transcribe(audio:{bytes:Uint8Array;sampleRate:number;durationMs:number},context:VoiceContext):Promise<{text:string;language:string;durationMs:number}>;cancel(taskId:string):Promise<{settled:boolean}>}
export interface TtsProvider{descriptor:VoiceProviderDescriptor;speak(text:string,context:VoiceContext):Promise<{firstAudioMs:number;finished:boolean}>;cancel(taskId:string):Promise<{settled:boolean}>}
export const VOICE_LIMITS=Object.freeze({clipMs:15000,bytes:2000000,reviewBeforeSend:true,halfDuplex:true,onlineFallback:false})
