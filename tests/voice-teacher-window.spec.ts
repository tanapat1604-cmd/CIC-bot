import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {readVoiceConfig} from '../backend/voice/runtime'
test('teacher window requires both explicit experiment flags and forbids other profiles/context',async()=>{
 const cwd=process.cwd(),flag=process.env.CIC_ASR_WINDOW_COMPARE,teacherFlag=process.env.CIC_ASR_TEACHER_COMPARE,config=JSON.parse(await fs.readFile('.tools/voice-config.json','utf8')),folder=await fs.mkdtemp(path.resolve('validation/2026-10-14-teacher-window/config-fixture-'))
 if(!folder.startsWith(path.resolve('validation/2026-10-14-teacher-window')+path.sep))throw Error('Unsafe fixture')
 try{await fs.mkdir(folder+'/.tools');process.chdir(folder);const candidate={...config,asrModel:'whisper-th-small-combined-cpu-int8',asrDecodeProfile:'thai-window6-v1'}
  await fs.writeFile('.tools/voice-config.json',JSON.stringify(candidate));delete process.env.CIC_ASR_WINDOW_COMPARE;expect(readVoiceConfig()).toBeNull()
  process.env.CIC_ASR_WINDOW_COMPARE='1';delete process.env.CIC_ASR_TEACHER_COMPARE;expect(readVoiceConfig()).toBeNull();process.env.CIC_ASR_TEACHER_COMPARE='1';expect(readVoiceConfig()?.asrDecodeProfile).toBe('thai-window6-v1')
  for(const invalid of [{...candidate,asrContext:'apps'},{...candidate,asrDecodeProfile:'thai-command-v1'},{...candidate,asrDecodeProfile:'thai-window12-v1'}]){await fs.writeFile('.tools/voice-config.json',JSON.stringify(invalid));expect(readVoiceConfig()).toBeNull()}
  delete process.env.CIC_ASR_WINDOW_COMPARE;await fs.writeFile('.tools/voice-config.json',JSON.stringify(config));expect(readVoiceConfig()?.asrDecodeProfile).toBe(config.asrDecodeProfile)
 }finally{process.chdir(cwd);if(flag===undefined)delete process.env.CIC_ASR_WINDOW_COMPARE;else process.env.CIC_ASR_WINDOW_COMPARE=flag;if(teacherFlag===undefined)delete process.env.CIC_ASR_TEACHER_COMPARE;else process.env.CIC_ASR_TEACHER_COMPARE=teacherFlag;await fs.rm(folder,{recursive:true,force:true})}
})
