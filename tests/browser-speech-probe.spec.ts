import {test,expect} from '@playwright/test'
import {probeBrowserSpeech} from '../src/voice/browserSpeechProbe'
test('local: capability probe checks languages separately and never starts, installs or sends audio',async()=>{
 const calls:unknown[]=[];let starts=0,downloads=0
 class Speech{processLocally=false;start(){starts++}static install(){downloads++}static async available(options:{langs:string[];processLocally:true}){calls.push(options);return options.langs[0]==='th-TH'?'unavailable' as const:'available' as const}}
 const result=await probeBrowserSpeech({SpeechRecognition:Speech})
 expect(calls).toEqual([{langs:['th-TH'],processLocally:true},{langs:['en-US'],processLocally:true}]);expect(result).toMatchObject({localThai:'unavailable',localEnglish:'available',microphoneStarted:false,audioSent:false,modelsDownloaded:false});expect(starts).toBe(0);expect(downloads).toBe(0)
})
test('local: older recognizer without enforced local processing cannot trigger remote fallback',async()=>{
 let starts=0,checks=0;class Old{start(){starts++}static async available(){checks++;return 'available' as const}}
 const result=await probeBrowserSpeech({SpeechRecognition:Old});expect(result.localThai).toBe('unsupported');expect(starts).toBe(0);expect(checks).toBe(0)
})
test('local: denied capability or unknown status stays unaccepted, without microphone request',async()=>{
 let starts=0;class Speech{processLocally=false;start(){starts++}static async available(options:{langs:string[]}){if(options.langs[0]==='th-TH')throw Error('denied');return 'unexpected' as const}}
 const result=await probeBrowserSpeech({webkitSpeechRecognition:Speech});expect(result.localThai).toBe('unknown');expect(result.localEnglish).toBe('unknown');expect(starts).toBe(0)
})
