import {spawn} from 'node:child_process'
import {randomUUID,createHash} from 'node:crypto'
import {freemem} from 'node:os'
import path from 'node:path'
import {mkdir,readFile,writeFile,rm,realpath,lstat,access} from 'node:fs/promises'
import {existsSync,readFileSync} from 'node:fs'
import {OCR_LIMITS,imageHeader,parseOcrInput,type OcrInput,type OcrJob,type OcrResult} from '../shared/ocr.js'
export class OcrError extends Error {constructor(public code:string){super(code)}}
type Execute=(dir:string,input:OcrInput,signal:AbortSignal)=>Promise<OcrResult>
type Options={root?:string;python?:string;engine?:string;data?:string;ready?:boolean;execute?:Execute;timeoutMs?:number;stopGraceMs?:number;freeMiB?:()=>number}
type Entry={owner:string;job:OcrJob;controller:AbortController;created:number;expiry?:ReturnType<typeof setTimeout>;clearing?:boolean}
export function createOcrManager(options:Options={}){
 const root=path.resolve(options.root??'.cic-user-files/ocr'),python=options.python??process.env.CIC_OCR_PYTHON,engine=options.engine??process.env.CIC_OCR_ENGINE,data=options.data??process.env.CIC_OCR_DATA
 const worker=path.resolve('scripts/ocr-worker.py')
 let configured=options.ready??(process.platform==='win32'&&!!python&&!!engine&&!!data&&[python,engine,path.join(data??'','tha.traineddata'),path.join(data??'','eng.traineddata'),worker].every(p=>path.isAbsolute(p)&&existsSync(p)))
 if(configured&&!options.execute){try{const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');configured=hash(engine!)==='c66f0f12ed76f6aa455dac97684bbc86756d6a732380bee09122454cfda3f420'&&hash(path.join(data!,'tha.traineddata'))==='294227cc2d1292b0acb28d61d4115c88252b96d466ca90b417cf4cf0c67bf07c'&&hash(path.join(data!,'eng.traineddata'))==='7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2'}catch{configured=false}}
 const entries=new Map<string,Entry>(),cancelledOperations=new Map<string,number>();let active:Entry|null=null,closed=false,cleanupFault=false
 const status=()=>({configured,busy:!!active||cleanupFault,engine:'Tesseract fast',languages:['tha','eng','tha+eng'],limits:OCR_LIMITS,review:'required',planning:'user-selected-language-and-regions',location:'local'})
 const expire=()=>{for(const[id,e]of entries)if(e!==active&&performance.now()-e.created>600000)entries.delete(id);for(const[id,time]of cancelledOperations)if(Date.now()-time>60000)cancelledOperations.delete(id)}
 const own=(owner:string,id:string)=>{expire();const e=entries.get(id);if(!e||e.owner!==owner||e.clearing)throw new OcrError('not-found');return e}
 const execute:Execute=options.execute??(async(dir,input,signal)=>{
  await access(python!);const process=spawn(python!,['-I',worker,dir,engine!,data!],{shell:false,windowsHide:true,stdio:'ignore',env:{...globalThis.process.env,OMP_THREAD_LIMIT:'1'}})
  const cancel=()=>{void writeFile(path.join(dir,'cancel.requested'),'cancel',{flag:'wx'}).catch(()=>{})};signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel()
  let exit:number|null
  try{exit=await new Promise<number|null>((resolve,reject)=>{process.once('error',reject);process.once('close',resolve)})}finally{signal.removeEventListener('abort',cancel)}
  if(signal.aborted)throw new OcrError('cancelled')
  if(exit!==0){let code='ocr-failed';try{code=JSON.parse(await readFile(path.join(dir,'error.json'),'utf8')).code}catch{/* No private stderr exposed. */}throw new OcrError(['unsupported','too-large','dimensions','decode-failed','timeout','output-limit','ocr-failed'].includes(code)?code:'ocr-failed')}
  const bytes=await readFile(path.join(dir,'result.json'));if(bytes.length>1024*1024)throw new OcrError('output-limit');const r=JSON.parse(bytes.toString('utf8')) as OcrResult
  if(typeof r.text!=='string'||r.text.length>OCR_LIMITS.textChars||!Array.isArray(r.words)||r.words.length>OCR_LIMITS.words||r.width!==input.width||r.height!==input.height||r.engine!=='Tesseract fast'||r.source.frameId!==input.source.frameId||r.source.sourceId!==input.source.sourceId||!Array.isArray(r.transforms)||r.transforms.length!==input.regions.length)throw new OcrError('ocr-failed')
  if(r.words.some(w=>typeof w.text!=='string'||![w.x,w.y,w.width,w.height].every(Number.isFinite)||w.x<0||w.y<0||w.width<=0||w.height<=0||w.x+w.width>r.width+.001||w.y+w.height>r.height+.001))throw new OcrError('ocr-failed')
  return r
 })
 async function cleanup(dir:string){const stat=await lstat(dir);if(stat.isSymbolicLink()||(await realpath(dir)).toLowerCase()!==dir.toLowerCase()||!dir.toLowerCase().startsWith(root.toLowerCase()+path.sep))throw new OcrError('storage-error');await rm(dir,{recursive:true,force:true})}
 async function run(e:Entry,input:OcrInput,bytes:Buffer){
  const dir=path.join(root,e.job.id);let created=false,timedOut=false,result:OcrResult|undefined,grace:ReturnType<typeof setTimeout>|undefined
  const stopping=()=>{grace=setTimeout(()=>{if(active===e){e.job.state='error';e.job.error='stop-unverified'}},options.stopGraceMs??3000)}
  e.controller.signal.addEventListener('abort',stopping,{once:true})
  const timer=setTimeout(()=>{timedOut=true;e.job.state='cancelling';e.controller.abort()},options.timeoutMs??OCR_LIMITS.timeoutMs)
  try{
   await mkdir(root,{recursive:true});if((await realpath(root)).toLowerCase()!==root.toLowerCase())throw new OcrError('storage-error')
   await mkdir(dir);created=true;await writeFile(path.join(dir,'image.bin'),bytes,{flag:'wx'});await writeFile(path.join(dir,'request.json'),JSON.stringify(input),{flag:'wx'})
   e.controller.signal.throwIfAborted();result=await execute(dir,input,e.controller.signal);e.controller.signal.throwIfAborted()
  }catch(error){delete e.job.result;e.job.state=e.controller.signal.aborted&&!timedOut?'cancelled':'error';e.job.error=timedOut?'timeout':e.controller.signal.aborted?'cancelled':error instanceof OcrError?error.code:'ocr-failed'}
  finally{
   clearTimeout(timer);if(grace)clearTimeout(grace);e.controller.signal.removeEventListener('abort',stopping)
   try{if(created)await cleanup(dir)}
   catch{cleanupFault=true;e.job.state='error';e.job.error='cleanup-failed';delete e.job.result}
   if(result&&!e.controller.signal.aborted&&!cleanupFault){e.job.result=result;e.job.state='ready'}
   else if(result&&e.controller.signal.aborted){e.job.state=timedOut?'error':'cancelled';e.job.error=timedOut?'timeout':undefined}
   active=null;if(e.clearing)entries.delete(e.job.id)
  }
 }
 return {
  status,isBusy:()=>!!active||cleanupFault,
  create(owner:string,value:unknown):OcrJob{
   expire();if(!configured||closed)throw new OcrError('not-configured');if(active||cleanupFault)throw new OcrError('busy');if(entries.size>=OCR_LIMITS.jobs)throw new OcrError('capacity');if((options.freeMiB??(()=>freemem()/1048576))()<256)throw new OcrError('memory-low')
   let input:OcrInput;try{input=parseOcrInput(value)}catch{throw new OcrError('invalid')}
   if(cancelledOperations.has(owner+'\0'+input.operationId))throw new OcrError('cancelled')
   const bytes=Buffer.from(input.imageBase64,'base64');if(!bytes.length||bytes.length>OCR_LIMITS.bytes||bytes.toString('base64')!==input.imageBase64)throw new OcrError('too-large')
   let h:ReturnType<typeof imageHeader>;try{h=imageHeader(bytes)}catch{throw new OcrError('unsupported')}
   if(h.width!==input.width||h.height!==input.height)throw new OcrError('dimensions')
   if([...entries.values()].some(e=>e.owner===owner&&e.job.operationId===input.operationId))throw new OcrError('invalid')
   const job:OcrJob={id:randomUUID(),operationId:input.operationId,state:'running',source:input.source};const e:Entry={job,owner,controller:new AbortController(),created:performance.now()};entries.set(job.id,e);active=e;e.expiry=setTimeout(()=>{if(e!==active){entries.delete(job.id)}else{e.clearing=true;e.controller.abort()}},600000);e.expiry.unref()
   // Base64 is not persisted: only bounded bytes and non-image options reach worker.
   const workerInput={...input,imageBase64:''};void run(e,workerInput,bytes);return {...job}
  },
  get(owner:string,id:string):OcrJob{return {...own(owner,id).job}},
  cancel(owner:string,id:string):OcrJob{const e=own(owner,id);if(e===active){e.job.state='cancelling';e.controller.abort()}return {...e.job}},
  cancelOperation(owner:string,id:string){expire();if(!/^[a-f0-9-]{36}$/.test(id))throw new OcrError('invalid');const key=owner+'\0'+id;if(cancelledOperations.size>=128&&!cancelledOperations.has(key))throw new OcrError('capacity');cancelledOperations.set(key,Date.now());if(active?.owner===owner&&active.job.operationId===id){active.job.state='cancelling';active.controller.abort()}},
  clear(owner:string,id:string){const e=own(owner,id);if(e.expiry)clearTimeout(e.expiry);if(e===active){e.clearing=true;e.controller.abort()}else entries.delete(id)},
  reference(owner:string,id:string,text:string){const e=own(owner,id);if(e.job.state!=='ready'||!e.job.result||typeof text!=='string'||!text.trim()||text.length>OCR_LIMITS.textChars)throw new OcrError('invalid-reference');return {kind:'ocr-reference',engine:e.job.result.engine,rawText:e.job.result.text,reviewedText:text,source:e.job.source,languages:e.job.result.languages,edited:text!==e.job.result.text}},
  close(){closed=true;for(const e of entries.values())if(e.expiry)clearTimeout(e.expiry);if(active)active.controller.abort();for(const[id,e]of entries)if(e!==active)entries.delete(id)}
 }
}
