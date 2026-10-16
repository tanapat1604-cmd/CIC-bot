import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import type {SpeechOutput} from './runtime.js'
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex')
const valid=(wav:Buffer)=>wav.length>=44&&wav.length<=2000000&&wav.toString('ascii',0,4)==='RIFF'&&wav.toString('ascii',8,12)==='WAVE'&&wav.readUInt32LE(4)===wav.length-8&&wav.readUInt16LE(20)===1&&wav.readUInt16LE(22)===1&&wav.readUInt32LE(24)===22050&&wav.readUInt16LE(34)===16
// Only generated fixed replies; no microphone PCM/transcript or arbitrary text.
// Asset integrity is checked by runtime before either memory or disk cache.
export class FixedSpeechDisk{
 constructor(private root=path.resolve('.tools/voice-fixed-cache'),private limit=16){}
 async directory(){await fs.mkdir(this.root,{recursive:true});if((await fs.lstat(this.root)).isSymbolicLink()||(await fs.realpath(this.root)).toLowerCase()!==path.resolve(this.root).toLowerCase())throw Error('cache-location')}
 async get(key:string,phrase:string):Promise<SpeechOutput|undefined>{try{await this.directory();const file=path.join(this.root,sha(key)+'.json'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2700000||Date.now()-stat.mtimeMs>7*86400000)return undefined;const v=JSON.parse(await fs.readFile(file,'utf8'));if(v.version!==1||v.keyHash!==sha(key)||v.phrase!==phrase||typeof v.wav!=='string'||v.wav.length>2670000)return undefined;const wav=Buffer.from(v.wav,'base64');if(wav.toString('base64')!==v.wav||!valid(wav)||sha(wav)!==v.audioHash)return undefined;return{kind:'tts',phrase,wav,elapsedMs:0,peakWorkingSetMiB:null,cacheHit:true}}catch{return undefined}}
 async put(key:string,result:SpeechOutput){if(result.kind!=='tts'||!result.wav||!result.phrase||!valid(result.wav))return;try{await this.directory();const name=sha(key)+'.json',target=path.join(this.root,name);const record={version:1,keyHash:sha(key),phrase:result.phrase,audioHash:sha(result.wav),wav:result.wav.toString('base64')};const stat=await fs.lstat(target).catch(()=>null);if(stat?.isSymbolicLink())return;await fs.writeFile(target,JSON.stringify(record));const entries=await fs.readdir(this.root);const owned=await Promise.all(entries.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(async n=>({name:n,stat:await fs.lstat(path.join(this.root,n))})));let total=owned.reduce((n,f)=>n+f.stat.size,0);const order=owned.sort((a,b)=>a.stat.mtimeMs-b.stat.mtimeMs);while(order.length>this.limit||total>12000000){const old=order.shift()!;if(old.stat.isFile()&&!old.stat.isSymbolicLink()){await fs.unlink(path.join(this.root,old.name));total-=old.stat.size}}}catch{/* A cache write failure cannot turn speech into an accepted result. */}}
}
