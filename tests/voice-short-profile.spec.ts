import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {prepareSpeech,captureSpeech} from '../src/voice/capture'
import {readVoiceConfig} from '../backend/voice/runtime'
import {parseVoiceRequest} from '../shared/voice'
test('unchanged short human Stop passes experimental profile without padding, while default stays unchanged',async()=>{
 const plan=JSON.parse(await fs.readFile('validation/2026-10-13-short-speech/PLAN-before-inference.json','utf8')),clip=plan.development.find((c:{id:string})=>c.id==='control-5'),bytes=await fs.readFile(clip.file)
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(clip.sha256)
 let pcm:Buffer|undefined
 for(let offset=12;offset+8<=bytes.length;){const length=bytes.readUInt32LE(offset+4);if(bytes.toString('ascii',offset,offset+4)==='data'){pcm=bytes.subarray(offset+8,offset+8+length);break}offset+=8+length+(length%2)}
 if(!pcm)throw Error('WAV data missing');const samples=new Int16Array(pcm.length/2);for(let i=0;i<samples.length;i++)samples[i]=pcm.readInt16LE(i*2)
 expect(prepareSpeech(samples).pcm).toBeNull()
 const candidate=prepareSpeech(samples,180);expect(candidate.summary.activeMs).toBe(240);expect(candidate.pcm).not.toBeNull();expect(candidate.pcm!.length).toBeLessThanOrEqual(samples.length);expect(candidate.pcm!.length).toBeGreaterThanOrEqual(4000)
 expect(prepareSpeech(samples,250).pcm).toBeNull()
})
test('experimental capture still rejects silence/transients and unsupported profiles before microphone access',async()=>{
 for(const count of [100,2000,32000])expect(prepareSpeech(new Int16Array(count),180).pcm).toBeNull()
 const transient=new Int16Array(16000);transient[500]=25000;expect(prepareSpeech(transient,180).pcm).toBeNull()
 expect(()=>prepareSpeech(new Int16Array(16000),190 as 180)).toThrow('invalid-signal-profile')
 await expect(captureSpeech(()=>{throw Error('No audio')},()=>{},()=>true,undefined,{minimumActivityMs:190 as 180})).rejects.toThrow('invalid-signal-profile')
 expect(()=>parseVoiceRequest({version:1,operationId:randomUUID(),kind:'asr',acknowledged:true,pcm:Buffer.alloc(16000).toString('base64'),minimumActivityMs:180})).toThrow()
})
test('180 config requires explicit backend experiment flag; unknown or unflagged profiles never become defaults',async()=>{
 const originalDirectory=process.cwd(),originalFlag=process.env.CIC_ASR_SHORT_WORD_COMPARE,config=JSON.parse(await fs.readFile('.tools/voice-config.json','utf8')),folder=await fs.mkdtemp(path.resolve('validation/2026-10-13-short-speech/config-fixture-'))
 const parent=path.resolve(originalDirectory,'validation/2026-10-13-short-speech')+path.sep;if(!path.resolve(folder).startsWith(parent))throw Error('Unsafe fixture cleanup');
 try{
  await fs.mkdir(path.join(folder,'.tools'));process.chdir(folder)
  await fs.writeFile('.tools/voice-config.json',JSON.stringify({...config,asrMinimumActivityMs:180}));delete process.env.CIC_ASR_SHORT_WORD_COMPARE;expect(readVoiceConfig()).toBeNull()
  process.env.CIC_ASR_SHORT_WORD_COMPARE='1';expect(readVoiceConfig()?.asrMinimumActivityMs).toBe(180)
  await fs.writeFile('.tools/voice-config.json',JSON.stringify({...config,asrMinimumActivityMs:170}));expect(readVoiceConfig()).toBeNull()
  delete process.env.CIC_ASR_SHORT_WORD_COMPARE;await fs.writeFile('.tools/voice-config.json',JSON.stringify(config));expect(readVoiceConfig()?.asrMinimumActivityMs).toBeUndefined()
 }finally{process.chdir(originalDirectory);if(originalFlag===undefined)delete process.env.CIC_ASR_SHORT_WORD_COMPARE;else process.env.CIC_ASR_SHORT_WORD_COMPARE=originalFlag;await fs.rm(folder,{recursive:true,force:true})}
})
