import {probeBrowserSpeech,type BrowserSpeechCapability} from './browserSpeechProbe'
type LocalConstructor={new():{processLocally?:boolean};install?:(options:{langs:string[];processLocally:true})=>Promise<boolean>}
export type LocalSpeechInstallation={at:string;requestedLanguages:['th-TH','en-US'];installerReturned:boolean;capability:BrowserSpeechCapability;microphoneStarted:false;audioSent:false;weightTrainingPerformed:false}
// Browser vendor language packs only. Never enable remote recognition or open a mic.
export async function installLocalSpeech(browser:unknown=window):Promise<LocalSpeechInstallation>{
 const surface=browser as {SpeechRecognition?:LocalConstructor;webkitSpeechRecognition?:LocalConstructor},Speech=surface.SpeechRecognition??surface.webkitSpeechRecognition
 if(!Speech||typeof Speech.install!=='function')throw Error('เบราว์เซอร์นี้ยังติดตั้งระบบฟังสดในเครื่องไม่ได้')
 const instance=new Speech();if(!('processLocally'in instance))throw Error('ยังยืนยันการประมวลผลในเครื่องไม่ได้');instance.processLocally=true;if(instance.processLocally!==true)throw Error('ยังยืนยันการประมวลผลในเครื่องไม่ได้')
 const installerReturned=await Speech.install({langs:['th-TH','en-US'],processLocally:true})
 return{at:new Date().toISOString(),requestedLanguages:['th-TH','en-US'],installerReturned,capability:await probeBrowserSpeech(browser),microphoneStarted:false,audioSent:false,weightTrainingPerformed:false}
}
