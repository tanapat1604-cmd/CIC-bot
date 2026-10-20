export type RecognitionResult={isFinal:boolean;0?:{transcript:string}}
export type BrowserRecognizer={lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;processLocally?:boolean;onstart:(()=>void)|null;onresult:((e:{results:ArrayLike<RecognitionResult>})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void}
export type RecognizerConstructor=new()=>BrowserRecognizer
export type SpeechControl={finish:()=>Promise<void>;discard:()=>Promise<void>}
let held:BrowserRecognizer|undefined
export function recognizerConstructor(surface:unknown=window):RecognizerConstructor|undefined{const s=surface as {SpeechRecognition?:RecognizerConstructor;webkitSpeechRecognition?:RecognizerConstructor};return s.SpeechRecognition??s.webkitSpeechRecognition}
// Final text is delivered once after the recognizer confirms microphone end.
// A missing end event retains the lock and prevents overlapping microphone use.
export function listenBrowser(options:{consented:boolean;language:'th-TH'|'en-US';current:()=>boolean;ready:()=>void;draft:(text:string)=>void;final:(text:string)=>void;error:(code:string)=>void;Constructor?:RecognizerConstructor;durationMs?:number;stopMs?:number}):SpeechControl{
 if(!options.consented)throw Error('consent-required')
 if(held)throw Error('stop-unverified')
 const Speech=options.Constructor??recognizerConstructor();if(!Speech)throw Error('unsupported')
 const rec=new Speech();held=rec;rec.lang=options.language;rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;if('processLocally'in rec)rec.processLocally=false
 let ended=false,discarded=false,stopping=false,text='',failure='',resolveEnd:()=>void=()=>{},endTimer:ReturnType<typeof setTimeout>|undefined
 const end=new Promise<void>(resolve=>resolveEnd=resolve)
 const duration=setTimeout(()=>{void control.finish().catch(()=>options.error('stop-unverified'))},options.durationMs??15000)
 async function stop(discard:boolean){if(discard){discarded=true;text=''}if(ended)return;if(!stopping){stopping=true;try{if(discard)rec.abort();else rec.stop()}catch{throw Error('stop-unverified')}}await Promise.race([end,new Promise<never>((_,reject)=>{endTimer=setTimeout(()=>reject(Error('stop-unverified')),options.stopMs??2500)})]);if(endTimer)clearTimeout(endTimer)}
 const control:SpeechControl={finish:()=>stop(false),discard:()=>stop(true)}
 rec.onstart=()=>{if(options.current()&&!discarded)options.ready();else void control.discard().catch(()=>options.error('stop-unverified'))}
 rec.onresult=e=>{if(ended||discarded||!options.current())return;const finals:string[]=[],drafts:string[]=[];for(let i=0;i<e.results.length;i++){const result=e.results[i],part=result[0]?.transcript??'';if(result.isFinal)finals.push(part);else drafts.push(part)}text=finals.join(' ').trim();options.draft([...finals,...drafts].join(' ').trim());if(text&&!stopping)void control.finish().catch(()=>options.error('stop-unverified'))}
 rec.onerror=e=>{failure=e.error;text=''}
 rec.onend=()=>{if(ended)return;ended=true;clearTimeout(duration);if(endTimer)clearTimeout(endTimer);if(held===rec)held=undefined;resolveEnd();if(discarded||!options.current())return;if(failure)options.error(failure);else if(!text)options.error('no-speech');else options.final(text)}
 try{rec.start()}catch{discarded=true;clearTimeout(duration);if(held===rec)held=undefined;resolveEnd();throw Error('start-failed')}
 return control
}
