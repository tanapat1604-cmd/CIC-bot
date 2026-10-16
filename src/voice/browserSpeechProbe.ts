export type BrowserSpeechCapability={checkedAt:string;supported:boolean;localThai:'available'|'downloadable'|'downloading'|'unavailable'|'unsupported'|'unknown';localEnglish:'available'|'downloadable'|'downloading'|'unavailable'|'unsupported'|'unknown';microphoneStarted:false;audioSent:false;modelsDownloaded:false}
type Status=BrowserSpeechCapability['localThai']
type Constructor={new():{processLocally?:boolean};available?:(options:{langs:string[];processLocally:true})=>Promise<Status>;prototype:object}
export async function probeBrowserSpeech(browser:unknown=window):Promise<BrowserSpeechCapability>{
 const surface=browser as {SpeechRecognition?:Constructor;webkitSpeechRecognition?:Constructor},Speech=surface.SpeechRecognition??surface.webkitSpeechRecognition
 const result:BrowserSpeechCapability={checkedAt:new Date().toISOString(),supported:typeof Speech==='function',localThai:'unsupported',localEnglish:'unsupported',microphoneStarted:false,audioSent:false,modelsDownloaded:false}
 if(!Speech||typeof Speech!=='function'||typeof Speech.available!=='function')return result
 const instance=new Speech();if(!('processLocally'in instance))return result;instance.processLocally=true;if(instance.processLocally!==true)return result
 const check=async(language:string):Promise<Status>=>{let timer:ReturnType<typeof setTimeout>|undefined;try{const value=await Promise.race([Speech.available!({langs:[language],processLocally:true}),new Promise<'unknown'>(resolve=>{timer=setTimeout(()=>resolve('unknown'),2500)})]);return['available','downloadable','downloading','unavailable'].includes(value)?value:'unknown'}catch{return'unknown'}finally{if(timer)clearTimeout(timer)}}
 result.localThai=await check('th-TH');result.localEnglish=await check('en-US');return result
}
