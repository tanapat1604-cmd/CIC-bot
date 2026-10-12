import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {freemem,totalmem} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const check=(id,state,detail)=>({id,state,detail});
const localPath=value=>typeof value==='string'&&path.isAbsolute(value)&&!value.startsWith('\\\\');
async function artifacts(root){
 try{
  const location=path.join(root,'.tools','voice-config.json');if((await fs.stat(location)).size>131072)throw Error('config');
  const config=JSON.parse(await fs.readFile(location,'utf8'));
  if(config.asrModel!==undefined&&!['faster-whisper-base-cpu-int8','faster-whisper-small-cpu-int8','distill-whisper-th-small-cpu-int8'].includes(config.asrModel))throw Error('config');
  if(config.asrDecodeProfile!==undefined&&!['legacy','thai-command-v1'].includes(config.asrDecodeProfile)||config.asrDecodeProfile==='thai-command-v1'&&(config.asrModel!=='distill-whisper-th-small-cpu-int8'||config.asrContext==='apps'))throw Error('config');
  if(!['python','worker','asr','tts'].every(key=>localPath(config[key]))||!/^[a-f0-9]{64}$/.test(config.workerHash)||!Array.isArray(config.files)||config.files.length<4||config.files.length>16)throw Error('config');
  for(const key of ['python','worker','tts'])if(!(await fs.stat(config[key])).isFile())throw Error('missing');
  if(!(await fs.stat(config.asr)).isDirectory())throw Error('missing');
  for(const entry of config.files)if(!localPath(entry.path)||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('config');
  const required=[config.tts,config.tts+'.json',...['model.bin','config.json','tokenizer.json',config.asrModel==='distill-whisper-th-small-cpu-int8'?'vocabulary.json':'vocabulary.txt'].map(name=>path.join(config.asr,name))];
  if(required.some(file=>!config.files.some(entry=>path.resolve(entry.path)===path.resolve(file))))throw Error('coverage');
  let bytes=0;
  for(const entry of [...config.files,{path:config.worker,sha256:config.workerHash}]){
   const stat=await fs.stat(entry.path);bytes+=stat.size;if(!stat.isFile()||stat.size>1073741824||bytes>2147483648)throw Error('size');
   const digest=createHash('sha256');for await(const chunk of createReadStream(entry.path))digest.update(chunk);
   if(digest.digest('hex')!==entry.sha256)throw Error('integrity');
  }
  return check('voice-files','pass','พบไฟล์ Python/worker/โมเดล และ SHA256 ตรง config; ยังไม่ได้ทดสอบ import หรือรันเสียง');
 }catch{return check('voice-files','fail','ไฟล์เสียง/config ขาด ผิดรูปแบบ หรือ hash ไม่ตรง ต้องตรวจการติดตั้งก่อน ไม่ได้เปิดไมค์หรือรัน worker')}
}
async function probe(id){
 const urls={frontend:'http://127.0.0.1:5173/CIC-bot/',backend:'http://127.0.0.1:8787/health',ollama:'http://127.0.0.1:11434/api/version'};
 try{
  const response=await fetch(urls[id],{redirect:'error',signal:AbortSignal.timeout(4000)});
  if(id==='frontend'){await response.body?.cancel();return response.ok}
  const text=await response.text();if(text.length>65536||!response.ok)return false;const body=JSON.parse(text);
  return id==='backend'?body.version===1&&body.ready===true&&body.kind==='live':typeof body.version==='string';
 }catch{return false}
}
export async function checkReadiness(options={}){
 const root=options.root??fileURLToPath(new URL('../',import.meta.url)),free=options.freeMiB??freemem()/1048576,total=options.totalMiB??totalmem()/1048576;
 let minimum=1152;try{const configPath=path.join(root,'.tools','voice-config.json');if((await fs.stat(configPath)).size<=131072){const config=JSON.parse(await fs.readFile(configPath,'utf8'));if(['faster-whisper-small-cpu-int8','distill-whisper-th-small-cpu-int8'].includes(config.asrModel))minimum=2048}}catch{/* Artifact check reports invalid config separately. */}
 const checks=[await artifacts(root),check('memory',Number.isFinite(free)&&free>=minimum?'pass':'fail',`RAM ว่าง ${Number.isFinite(free)?Math.round(free):'ตรวจไม่ได้'} MiB; เสียงต้องอย่างน้อย ${minimum.toLocaleString('en-US')} MiB; ไม่ลด guard`)]
 for(const result of await Promise.all(['frontend','backend','ollama'].map(async id=>options.offline?check(id,'skip','ไม่ได้ตรวจบริการในโหมด offline'):check(id,await(options.probe??probe)(id)?'pass':'fail','ตรวจตอบกลับบริการแบบอ่านอย่างเดียว ไม่สั่งงาน'))))checks.push(result)
 return {version:1,checkedAt:new Date().toISOString(),requiresFreeMiB:minimum,hardware:{totalMiB:Number.isFinite(total)?Math.round(total):null,freeMiB:Number.isFinite(free)?Math.round(free):null},checks,readyForManualTrial:checks.every(row=>row.state==='pass'),microphoneOpened:false,speechInferenceRun:false,filesModified:false,humanRecognition:'not-assessed',handsFreeAccepted:false,note:'ผ่านตัวตรวจนี้หมายถึงไฟล์/RAM/บริการพร้อมเริ่มทดลอง ยังไม่รับรองว่าไมค์จริงฟังคำถูกหรือควบคุม PC ได้'}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--offline')){process.stderr.write('ใช้: node scripts/cic-doctor.mjs [--offline]\n');process.exitCode=2}
 else{const report=await checkReadiness({offline:args.includes('--offline')});process.stdout.write(JSON.stringify(report,null,2)+'\n');process.exitCode=report.readyForManualTrial?0:1}
}
