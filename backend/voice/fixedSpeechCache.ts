import type {SpeechOutput} from './runtime.js'
// Fixed public phrases only. Never cache microphone PCM, ASR text, grants or jobs.
export class FixedSpeechCache{
 private values=new Map<string,SpeechOutput>();private bytes=0
 constructor(private readonly limit=8*1024*1024){}
 get(key:string){const value=this.values.get(key);if(!value)return;this.values.delete(key);this.values.set(key,value);return {...value,wav:Buffer.from(value.wav!)} }
 put(key:string,value:SpeechOutput){if(value.kind!=='tts'||!value.wav||value.wav.length>this.limit)return;const old=this.values.get(key);if(old){this.bytes-=old.wav!.length;this.values.delete(key)}while(this.bytes+value.wav.length>this.limit){const first=this.values.keys().next().value!;this.bytes-=this.values.get(first)!.wav!.length;this.values.delete(first)}this.values.set(key,{...value,wav:Buffer.from(value.wav)});this.bytes+=value.wav.length}
}
