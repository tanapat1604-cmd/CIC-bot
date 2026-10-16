import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {readVoiceConfig} from '../backend/voice/runtime'
import {parseVoiceJob} from '../shared/voice'
test('CTC requires explicit experiment and matching profile, never becomes default implicitly',async()=>{
 const cwd=process.cwd(),flag=process.env.CIC_ASR_CTC_COMPARE,config=JSON.parse(await fs.readFile('.tools/voice-config.json','utf8')),folder=await fs.mkdtemp(path.resolve('validation/2026-10-13-ctc-voice/config-fixture-'))
 const parent=path.resolve('validation/2026-10-13-ctc-voice')+path.sep;if(!folder.startsWith(parent))throw Error('Unsafe fixture')
 try{await fs.mkdir(folder+'/.tools');process.chdir(folder)
  const candidate={...config,asrModel:'wav2vec2-thai-cpu-int8',asrDecodeProfile:'ctc-greedy-v1'}
  await fs.writeFile('.tools/voice-config.json',JSON.stringify(candidate));delete process.env.CIC_ASR_CTC_COMPARE;expect(readVoiceConfig()).toBeNull()
  process.env.CIC_ASR_CTC_COMPARE='1';expect(readVoiceConfig()?.asrModel).toBe(candidate.asrModel)
  for(const invalid of [{...candidate,asrDecodeProfile:'legacy'},{...config,asrDecodeProfile:'ctc-greedy-v1'},{...candidate,asrContext:'apps'}]){await fs.writeFile('.tools/voice-config.json',JSON.stringify(invalid));expect(readVoiceConfig()).toBeNull()}
  delete process.env.CIC_ASR_CTC_COMPARE;await fs.writeFile('.tools/voice-config.json',JSON.stringify(config));expect(readVoiceConfig()?.asrModel).toBe(config.asrModel)
 }finally{process.chdir(cwd);if(flag===undefined)delete process.env.CIC_ASR_CTC_COMPARE;else process.env.CIC_ASR_CTC_COMPARE=flag;await fs.rm(folder,{recursive:true,force:true})}
})
test('experimental model provenance parses while unknown model names remain forbidden',()=>{
 const job={version:1,taskId:randomUUID(),operationId:randomUUID(),kind:'asr',state:'succeeded',result:{text:'หยุด',language:'th',elapsedMs:200,peakWorkingSetMiB:500,asrModel:'wav2vec2-thai-cpu-int8',asrDecodeProfile:'ctc-greedy-v1'}}
 expect(parseVoiceJob(job).result?.asrModel).toBe('wav2vec2-thai-cpu-int8')
 expect(()=>parseVoiceJob({...job,result:{...job.result,asrModel:'untrusted'}})).toThrow()
})
