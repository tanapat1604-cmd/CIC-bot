import {spawn} from 'node:child_process'
import {createReadStream} from 'node:fs'
import {freemem} from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {CoreError} from '../shared/core.js'
export type VoiceModelArtifact={artifactId:'wav2vec2-thai-int8-v1'|'wav2vec2-thai-cv8-int8-v1';sourceModel:string;files:{file:string;bytes:number;sha256:string}[];durationMs:number;peakMiB:number|null}
export async function prepareVoiceModel(signal:AbortSignal,artifactId:VoiceModelArtifact['artifactId']='wav2vec2-thai-int8-v1'):Promise<VoiceModelArtifact>{
 if(process.env.CIC_ASR_CTC_PREPARE!=='1')throw new CoreError('unsupported')
 signal.throwIfAborted();if(freemem()<(artifactId==='wav2vec2-thai-cv8-int8-v1'?8192:10240)*1048576)throw new CoreError('memory')
 const cv8=artifactId==='wav2vec2-thai-cv8-int8-v1';if(!cv8&&artifactId!=='wav2vec2-thai-int8-v1')throw new CoreError('invalid')
 const sourceModel=cv8?'wannaphong/wav2vec2-large-xlsr-53-th-cv8-newmm':'airesearch/wav2vec2-large-xlsr-53-th',weightsFile=cv8?'model.safetensors':'pytorch_model.bin'
 const root=path.resolve('.'),source=path.join(root,'.tools/voice-models',cv8?'wav2vec2-th-cv8-source-v1':'wav2vec2-th-source-v1'),output=path.join(root,'.tools/voice-models',cv8?'wav2vec2-th-cv8-int8-v1':'wav2vec2-th-int8-v1'),python=path.join(root,'.tools/asr-converter/Scripts/python.exe'),script=path.join(root,'scripts/prepare-ctc-model.py')
 const manifest=JSON.parse(await fs.readFile(path.join(source,'SOURCE-MANIFEST.json'),'utf8'))
 if(manifest.id!==sourceModel||!/^[a-f0-9]{40}$/.test(manifest.revision)||!Array.isArray(manifest.downloadedFiles))throw new CoreError('model-source-invalid')
 for(const file of ['config.json','preprocessor_config.json','vocab.json','tokenizer_config.json','special_tokens_map.json',weightsFile]){
  const entry=manifest.downloadedFiles.find((v:{file:string})=>v.file===file);if(!entry||!/^[a-f0-9]{64}$/.test(entry.sha256))throw new CoreError('model-source-invalid')
  const location=path.join(source,file),info=await fs.stat(location);if(info.size!==entry.bytes||info.size>1400000000)throw new CoreError('model-source-invalid')
  const hash=createHash('sha256');for await(const chunk of createReadStream(location)){signal.throwIfAborted();hash.update(chunk)}if(hash.digest('hex')!==entry.sha256)throw new CoreError('model-source-invalid')
 }
 await fs.access(python);await fs.access(script);signal.throwIfAborted()
 const nonce=randomUUID(),temporary=output+'.prepare-'+nonce,began=performance.now()
 async function cleanupTemporary(){try{const actual=await fs.realpath(temporary),parent=await fs.realpath(path.dirname(output)),relative=path.relative(parent,actual);if(relative.startsWith('..')||path.isAbsolute(relative)||path.basename(actual)!==path.basename(temporary)||(await fs.lstat(temporary)).isSymbolicLink())throw new CoreError('model-cleanup-failed');await fs.rm(actual,{recursive:true,force:true})}catch(e){if(!(e instanceof Error&&'code'in e&&e.code==='ENOENT'))throw e}}
 let terminalVerified=false
 try{return await new Promise<VoiceModelArtifact>((resolve,reject)=>{
  const child=spawn(python,['-X','utf8',script,source,output,temporary],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:path.dirname(python)+';'+path.join(process.env.SystemRoot??'C:\\Windows','System32'),TEMP:process.env.TEMP,TMP:process.env.TMP,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',OMP_NUM_THREADS:'3',OPENBLAS_NUM_THREADS:'3',PYTHONUTF8:'1'}})
  let outputText='',stderrTail='',failure:CoreError|undefined,closed=false,killDeadline:ReturnType<typeof setTimeout>|undefined,total=0
  const stop=()=>{failure??=new CoreError('cancelled');child.kill();killDeadline??=setTimeout(()=>{if(!closed)reject(new CoreError('model-stop-unverified'))},5000);killDeadline.unref()}
  const timeout=setTimeout(()=>{failure=new CoreError('timeout');stop()},240000);timeout.unref();const memoryWatch=setInterval(()=>{if(cv8&&freemem()<2048*1048576){failure=new CoreError('model-memory-budget');stop()}},250);memoryWatch.unref()
  const clean=()=>{clearInterval(memoryWatch);clearTimeout(timeout);if(killDeadline)clearTimeout(killDeadline);signal.removeEventListener('abort',stop)}
  signal.addEventListener('abort',stop,{once:true})
  child.stdout.setEncoding('utf8');child.stdout.on('data',(chunk:string)=>{total+=Buffer.byteLength(chunk);if(total>262144){failure=new CoreError('model-output-limit');stop()}else outputText+=chunk})
  child.stderr.on('data',(chunk:Buffer)=>{stderrTail=(stderrTail+chunk.toString('utf8')).slice(-16000);total+=chunk.length;if(total>262144){failure=new CoreError('model-output-limit');stop()}})
  child.once('error',()=>{failure=new CoreError('model-prepare-unavailable');if(child.pid)stop();else{closed=true;terminalVerified=true;clean();reject(failure)}})
  child.once('close',code=>{closed=true;terminalVerified=true;clean();void(async()=>{try{const diagnosticDir=path.join(root,cv8?'validation/2026-10-13-ctc-cv8':'validation/2026-10-13-ctc-voice');await fs.mkdir(diagnosticDir,{recursive:true});await fs.writeFile(path.join(diagnosticDir,'PREPARE-DIAGNOSTIC-'+nonce+'.json'),JSON.stringify({closedAt:new Date().toISOString(),sourceModel:manifest.id,code,terminalVerified:true,elapsedMs:Math.round(performance.now()-began),stderrTail,noUserAudio:true},null,2),{flag:'wx'})}catch{/* Diagnostics never replace the authoritative child terminal outcome. */}if(failure||signal.aborted){reject(failure??new CoreError('cancelled'));return}try{if(code!==0)throw new CoreError('model-prepare-failed');const r=JSON.parse(outputText);if(cv8&&(typeof r.peakMiB!=='number'||!Number.isFinite(r.peakMiB)||r.peakMiB>6144||r.peakMiB<0)||r.artifactId!==artifactId||r.sourceModel!==manifest.id||!Array.isArray(r.files)||r.files.length!==4||new Set(r.files.map((f:{file:string})=>f.file)).size!==4||r.files.some((f:{file:string;bytes:number;sha256:string})=>!['model-int8.onnx','vocab.json','preprocessor_config.json','config.json'].includes(f.file)||!Number.isSafeInteger(f.bytes)||f.bytes<1||!/^[a-f0-9]{64}$/.test(f.sha256)))throw new CoreError('model-prepare-failed');resolve({artifactId:r.artifactId,sourceModel:r.sourceModel,files:r.files,durationMs:Math.round(performance.now()-began),peakMiB:r.peakMiB??null})}catch(e){reject(e instanceof CoreError?e:new CoreError('model-prepare-failed'))}})()})
  if(signal.aborted)stop()
 })}finally{
  if(terminalVerified)await cleanupTemporary()
 }
}
