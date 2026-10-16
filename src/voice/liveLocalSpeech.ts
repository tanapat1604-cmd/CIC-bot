import type {Capture} from './capture'
import {probeBrowserSpeech} from './browserSpeechProbe'
export type LiveSpeechEvidence={source:'browser-on-device';language:'th-TH'|'en-US';operationId:string;processLocally:true;startedAt:number;speechEndedAt?:number;firstInterimAt?:number;finalAt?:number;recognizerEndedAt?:number;boundary:'browser-speechend-event';inputLatencyUnmeasured:true;rawAudioSaved:false;accepted:false}
type Result={isFinal:boolean;length:number;[index:number]:{transcript:string;confidence:number}}
export type LocalRecognizer={processLocally?:boolean;lang:string;interimResults:boolean;continuous:boolean;maxAlternatives:number;onstart:(()=>void)|null;onspeechend:(()=>void)|null;onresult:((event:{results:{length:number;[index:number]:Result}})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void}
type Constructor={new():LocalRecognizer}
let held:LocalRecognizer|undefined
// An interim hypothesis never calls the router. Final text is dispatched once,
// only after the recognizer confirms its microphone session ended.
export async function captureLocalSpeech(options:{language:'th-TH'|'en-US';operationId:string;isCurrent:()=>boolean;publish:(control:Capture)=>void;onReady:()=>void;onDraft:(text:string)=>void;onFinal:(text:string,evidence:LiveSpeechEvidence)=>void;onEvidence:(evidence:LiveSpeechEvidence)=>void;onError:(reason:string)=>void;browser?:unknown;stopDeadlineMs?:number}):Promise<Capture>{
 if(held)throw Error('voice-stop-unverified')
 const browser=options.browser??window,capability=await probeBrowserSpeech(browser),status=options.language==='th-TH'?capability.localThai:capability.localEnglish
 if(status!=='available')throw Error('local-speech-unavailable')
 if(!options.isCurrent())throw Error('cancelled')
 const surface=browser as {SpeechRecognition?:Constructor;webkitSpeechRecognition?:Constructor},Speech=surface.SpeechRecognition??surface.webkitSpeechRecognition;if(!Speech)throw Error('local-speech-unavailable')
 if(held)throw Error('voice-stop-unverified')
 const recognizer=new Speech();if(!('processLocally'in recognizer))throw Error('local-speech-unavailable');recognizer.processLocally=true;if(recognizer.processLocally!==true)throw Error('local-speech-unavailable');held=recognizer
 recognizer.lang=options.language;recognizer.interimResults=true;recognizer.continuous=false;recognizer.maxAlternatives=1
 const evidence:LiveSpeechEvidence={source:'browser-on-device',language:options.language,operationId:options.operationId,processLocally:true,startedAt:Date.now(),boundary:'browser-speechend-event',inputLatencyUnmeasured:true,rawAudioSaved:false,accepted:false}
 let ended=false,discarded=false,stopRequested=false,final='',failure='',releaseEnd:()=>void=()=>{},stopTimer:ReturnType<typeof setTimeout>|undefined,waiting:Promise<void>|undefined
 const endPromise=new Promise<void>(resolve=>releaseEnd=resolve),emit=()=>options.onEvidence({...evidence})
 const timer=setTimeout(()=>{if(!ended){failure='timeout';void control.discard().catch(()=>options.onError('voice-stop-unverified'))}},15000)
 const waitEnd=async()=>{if(ended)return;waiting??=Promise.race([endPromise,new Promise<never>((_,reject)=>{stopTimer=setTimeout(()=>reject(Error('voice-stop-unverified')),options.stopDeadlineMs??2500)})]);await waiting;if(stopTimer){clearTimeout(stopTimer);stopTimer=undefined}}
 const control:Capture={finish:async()=>{if(ended)return;if(!stopRequested){stopRequested=true;recognizer.stop()}await waitEnd()},discard:async()=>{discarded=true;final='';options.onDraft('');if(ended)return;if(!stopRequested){stopRequested=true;recognizer.abort()}await waitEnd()}}
 options.publish(control)
 recognizer.onstart=()=>{if(!options.isCurrent()){void control.discard().catch(()=>options.onError('voice-stop-unverified'));return}options.onReady();emit()}
 recognizer.onspeechend=()=>{evidence.speechEndedAt=Date.now();emit();if(!stopRequested){stopRequested=true;recognizer.stop()}}
 recognizer.onresult=event=>{if(ended||discarded||!options.isCurrent())return;const complete:string[]=[],draft:string[]=[];for(let i=0;i<event.results.length;i++){const r=event.results[i],text=r[0]?.transcript??'';if(r.isFinal)complete.push(text);else draft.push(text)}final=complete.join(' ').trim();const display=[...complete,...draft].join(' ').trim();if(display&&!evidence.firstInterimAt)evidence.firstInterimAt=Date.now();if(final)evidence.finalAt=Date.now();options.onDraft(display);emit()}
 recognizer.onerror=event=>{failure=event.error;final='';emit()}
 recognizer.onend=()=>{if(ended)return;ended=true;if(held===recognizer)held=undefined;clearTimeout(timer);if(stopTimer)clearTimeout(stopTimer);evidence.recognizerEndedAt=Date.now();emit();releaseEnd();if(discarded||!options.isCurrent())return;if(failure){options.onError(failure);return}if(!final){options.onError('no-speech');return}options.onDraft('');options.onFinal(final,{...evidence})}
 try{recognizer.start();if(!options.isCurrent())await control.discard();return control}catch(error){if(!ended){discarded=true;clearTimeout(timer);try{recognizer.abort()}catch{/* start failed before an owned microphone existed */}if((error as Error).message!=='voice-stop-unverified'&&held===recognizer)held=undefined;releaseEnd()}throw error}
}
