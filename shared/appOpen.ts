import {CoreError,exact,uuid} from './core.js'
export type VoiceCommand={kind:'notepad'|'chrome'|'youtube'|'music'|'stop'|'decline'|'unknown';instruction:string}
export function classifyVoiceCommand(value:string):VoiceCommand{
 const instruction=value.normalize('NFC').trim().replace(/^(?:เฮ้|เห้|hey)\s*(?:ซีไอซี|ซีไอ|ci\s*c?)\s*[,，:!]?\s*/iu,'').trim()
 if(!instruction||instruction.length>200||[...instruction].some(c=>c.charCodeAt(0)<32)||/[\\/]|https?:|www\.|\.exe|[;&|`<>]/iu.test(instruction))return{kind:'unknown',instruction}
 const text=instruction.toLowerCase().replace(/[?!.,]/g,'').trim()
 if(/^(?:หยุด|หยุดก่อน|หยุดทั้งหมด|stop|สต็อป|สต็อบ)\s*(?:ครับ|ค่ะ|นะ)?$/u.test(text))return{kind:'stop',instruction}
 // Negation is checked before any action. Unclear or compound requests fail closed.
 if(/ไม่|อย่า(?!ง)|ยกเลิก|ปฏิเสธ|ไม่อนุญาต|\b(?:don't|do not|cancel|deny)\b/u.test(text))return{kind:'decline',instruction}
 const prefix='(?:(?:ช่วย|please)\\s*)?(?:เปิด|เปิดโปรแกรม|open)\\s*',suffix='\\s*(?:ให้(?:ฉัน|ผม)?หน่อย|ให้หน่อย|หน่อย|ให้ผม|ให้ฉัน|ให้|ที|please|for me)?\\s*(?:ครับ|ค่ะ|นะ)?'
 // Closed phonetic spellings only. Preserve raw ASR text and show the canonical
 // app in a human-reviewed plan; this is not correction of the ASR transcript.
 for(const[kind,name]of [['notepad','(?:notepad|note pad|โน้ตเพด|(?:โน้ต|โน๊ต|โนต|โนท|โน้ท)\\s*(?:แพด|แผด|แพ็ด)|สมุดบันทึก)'],['chrome','(?:chrome|โครม|โครเมียม|กูเกิลโครม|google chrome)'],['youtube','(?:youtube|you tube|ยูทูบ|ยูทูป)']]as const){if(new RegExp('^'+prefix+name+suffix+'$','iu').test(text)||new RegExp('^'+name+'\\s*(?:ให้หน่อย|หน่อย|please)\\s*(?:ครับ|ค่ะ|นะ)?$','iu').test(text)||new RegExp('^'+prefix+name+'\\s*ให้ไหน\\s*(?:ครับ|ค่ะ|นะ)?$','iu').test(text))return{kind,instruction}}
 // Observed tail error from a user-confirmed full microphone clip. This creates
 // only the fixed YouTube plan; raw instruction and scoped approval remain.
 if(/^เปิด\s*(?:ยูทูป|ยูทูบ)\s*แด้หน่อย\s*(?:ครับ|ค่ะ|นะ)?$/u.test(text))return{kind:'youtube',instruction}
 if(/^(?:ช่วย\s*)?(?:เปิด|เล่น|ฟัง|ขอฟัง|play|listen)\s*.*(?:เพลง|music|song)/iu.test(text)&&!/(?:แล้ว|และ)\s*(?:เปิด|ปิด|ลบ|พิมพ์)/u.test(text))return{kind:'music',instruction}
 return{kind:'unknown',instruction}
}
export type AppOpenJob={version:1;taskId:string;operationId:string;appId:'chrome'|'youtube';destination?:'owned-chrome'|'normal-chrome';normalChromeLaunchRequested?:boolean;state:'waiting-permission'|'queued'|'running'|'succeeded'|'requested'|'failed'|'cancelling'|'cancelled'|'stop-unverified';reason?:string;result?:{source:'owned-chrome';url:'about:blank'|'https://www.youtube.com/';windowVerified:true;playbackVerified:false;elapsedMs:number}|{source:'installed-chrome-launcher';launchAccepted:true;windowVerified:false;playbackVerified:false;elapsedMs:number}}
export function parseAppOpenInput(v:unknown){if(!(exact(v,['version','operationId','appId'])||exact(v,['version','operationId','appId','destination']))||v.version!==1||!uuid(v.operationId)||!['chrome','youtube'].includes(String(v.appId))||v.destination!==undefined&&!['owned-chrome','normal-chrome'].includes(String(v.destination)))throw new CoreError('invalid');return{operationId:v.operationId as string,appId:v.appId as AppOpenJob['appId'],destination:(v.destination??'owned-chrome') as NonNullable<AppOpenJob['destination']>}}
export function parseAppOpenJob(v:unknown):AppOpenJob{
 if(!v||typeof v!=='object')throw new CoreError('protocol');const j=v as AppOpenJob
 if(j.version!==1||!uuid(j.taskId)||!uuid(j.operationId)||!['chrome','youtube'].includes(j.appId)||!['waiting-permission','queued','running','succeeded','requested','failed','cancelling','cancelled','stop-unverified'].includes(j.state)||j.destination!==undefined&&!['owned-chrome','normal-chrome'].includes(j.destination)||j.normalChromeLaunchRequested!==undefined&&typeof j.normalChromeLaunchRequested!=='boolean'||j.reason!==undefined&&(typeof j.reason!=='string'||j.reason.length>100))throw new CoreError('protocol')
 if(['succeeded','requested'].includes(j.state)&&!j.result)throw new CoreError('protocol')
 if(j.result){const r=j.result;if(!Number.isFinite(r.elapsedMs)||r.elapsedMs<0||r.playbackVerified!==false)throw new CoreError('protocol');if(r.source==='installed-chrome-launcher'){if(j.state!=='requested'||j.destination!=='normal-chrome'||j.normalChromeLaunchRequested!==true||!exact(r,['source','launchAccepted','windowVerified','playbackVerified','elapsedMs'])||r.launchAccepted!==true||r.windowVerified!==false)throw new CoreError('protocol')}else if(j.state!=='succeeded'||j.destination==='normal-chrome'||!exact(r,['source','url','windowVerified','playbackVerified','elapsedMs'])||r.source!=='owned-chrome'||r.url!==(j.appId==='chrome'?'about:blank':'https://www.youtube.com/')||r.windowVerified!==true)throw new CoreError('protocol')}
 return j
}


