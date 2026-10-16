import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const models=['faster-whisper-base-cpu-int8','faster-whisper-small-cpu-int8','distill-whisper-th-small-cpu-int8'];
export async function configureVoice({root,python,asr,tts,model,replace=false,dryRun=false}){
 if(!models.includes(model))throw Error('Select a supported --model label');
 const local=value=>{if(typeof value!=='string'||!path.isAbsolute(value)||value.startsWith('\\\\')||value.includes('\0'))throw Error('Use existing absolute local paths');return path.resolve(value)};
 root=local(root);python=local(python);asr=local(asr);tts=local(tts);
 const worker=path.join(root,'backend','voice','worker.py'),directory=path.join(root,'.tools'),destination=path.join(directory,'voice-config.json');
 if(!replace&&!dryRun){try{await fs.access(destination);throw Error('Configuration exists; use --replace only when you intend to replace it')}catch(e){if(e.code!=='ENOENT')throw e}}
 for(const file of [python,worker,tts])if(!(await fs.stat(file)).isFile())throw Error('Missing required file');
 if(!(await fs.stat(asr)).isDirectory())throw Error('ASR must be a CTranslate2 model directory');
 const files=[tts,tts+'.json',...['model.bin','config.json','tokenizer.json',model==='distill-whisper-th-small-cpu-int8'?'vocabulary.json':'vocabulary.txt'].map(name=>path.join(asr,name))];
 for(const optional of [path.join(path.dirname(tts),'MODEL_CARD'),path.join(asr,'preprocessor_config.json')]){try{if((await fs.stat(optional)).isFile())files.push(optional)}catch(e){if(e.code!=='ENOENT')throw e}}
 let bytes=0;
 const digest=async file=>{const stat=await fs.stat(file);bytes+=stat.size;if(!stat.isFile()||stat.size>1073741824||bytes>2147483648)throw Error('Model assets exceed bounded file sizes');const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')};
 const entries=[];for(const file of files)entries.push({path:file,sha256:await digest(file)});
 const config={python,worker,workerHash:await digest(worker),tts,asr,files:entries,asrModel:model,asrContext:'none',asrDecodeProfile:model==='distill-whisper-th-small-cpu-int8'?'thai-command-v1':'legacy'};
 if(!dryRun){await fs.mkdir(directory,{recursive:true});const temporary=path.join(directory,'voice-config.'+randomUUID()+'.tmp');try{await fs.writeFile(temporary,JSON.stringify(config,null,2),'utf8');if(replace)await fs.rename(temporary,destination);else{await fs.copyFile(temporary,destination,1);await fs.unlink(temporary)}}finally{await fs.unlink(temporary).catch(()=>{})}}
 return{written:!dryRun,model,verifiedAssetCount:entries.length,workerHash:config.workerHash,microphoneOpened:false,modelExecuted:false,networkUsed:false,recognitionAccepted:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),options={root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')};
  for(let i=0;i<args.length;i++){const flag=args[i];if(flag==='--replace')options.replace=true;else if(flag==='--dry-run')options.dryRun=true;else if(['--python','--asr','--tts','--model'].includes(flag)&&args[i+1]&&!args[i+1].startsWith('--')){const key=flag.slice(2);if(options[key])throw Error('Duplicate argument');options[key]=args[++i]}else throw Error('Usage: node scripts/configure-voice.mjs --python ABS --asr ABS --tts ABS --model LABEL [--dry-run] [--replace]')}
  console.log(JSON.stringify(await configureVoice(options),null,2));
 }catch(error){console.error(error.message);process.exitCode=1}
}
