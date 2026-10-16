import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {readVoiceConfig} from '../backend/voice/runtime'
test('short encoder profile requires operator flag and original Thai model/context',async()=>{
 const cwd=process.cwd(),flag=process.env.CIC_ASR_WINDOW_COMPARE,config=JSON.parse(await fs.readFile('.tools/voice-config.json','utf8')),folder=await fs.mkdtemp(path.resolve('validation/2026-10-13-whisper-window12/config-fixture-'))
 if(!folder.startsWith(path.resolve('validation/2026-10-13-whisper-window12')+path.sep))throw Error('Unsafe fixture')
 try{await fs.mkdir(folder+'/.tools');process.chdir(folder);const candidate={...config,asrDecodeProfile:'thai-window12-v1'}
  await fs.writeFile('.tools/voice-config.json',JSON.stringify(candidate));delete process.env.CIC_ASR_WINDOW_COMPARE;expect(readVoiceConfig()).toBeNull()
  process.env.CIC_ASR_WINDOW_COMPARE='1';expect(readVoiceConfig()?.asrDecodeProfile).toBe('thai-window12-v1')
  for(const invalid of [{...candidate,asrContext:'apps'},{...candidate,asrModel:'faster-whisper-base-cpu-int8'}]){await fs.writeFile('.tools/voice-config.json',JSON.stringify(invalid));expect(readVoiceConfig()).toBeNull()}
  delete process.env.CIC_ASR_WINDOW_COMPARE;await fs.writeFile('.tools/voice-config.json',JSON.stringify(config));expect(readVoiceConfig()?.asrDecodeProfile).toBe(config.asrDecodeProfile)
 }finally{process.chdir(cwd);if(flag===undefined)delete process.env.CIC_ASR_WINDOW_COMPARE;else process.env.CIC_ASR_WINDOW_COMPARE=flag;await fs.rm(folder,{recursive:true,force:true})}
})
