import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {freemem} from 'node:os';
import {planMusic,MUSIC_PLAN_SYSTEM} from '../.backend-build/backend/youtube/planner.js';
const file=new URL('../training/music-intent-v1/holdout.jsonl',import.meta.url),bytes=await fs.readFile(file),cases=bytes.toString('utf8').trim().split('\n').map(v=>JSON.parse(v));
const sha=v=>createHash('sha256').update(v).digest('hex'),limit=process.argv[2]===undefined?cases.length:Number(process.argv[2]);
if(!Number.isInteger(limit)||limit<1||limit>cases.length)throw Error('Expected case count 1..'+cases.length);
const dir=new URL('../training/music-intent-v1/results/',import.meta.url);await fs.mkdir(dir,{recursive:true});const out=new URL('baseline-'+Date.now()+'.json',dir);
const report={at:new Date().toISOString(),kind:'REAL-LOCAL-MODEL-AND-VALIDATOR-PIPELINE',evaluation:'development-regression-after-observing-baseline',model:'qwen3:0.6b',dataSha256:sha(bytes),promptSha256:sha(MUSIC_PLAN_SYSTEM),weightsTrained:false,totalCases:cases.length,selected:limit,rows:[],pass:0,fail:0,blocked:0};
report.pipelineSha256=sha(Buffer.concat(await Promise.all(['../.backend-build/backend/youtube/planner.js','../.backend-build/shared/youtube.js'].map(p=>fs.readFile(new URL(p,import.meta.url))))));
try{const tags=await(await fetch('http://127.0.0.1:11434/api/tags',{redirect:'error',signal:AbortSignal.timeout(2000)})).json();report.modelDigest=tags.models?.find(v=>v.name===report.model)?.digest??null}catch{report.modelDigest=null}
for(const c of cases.slice(0,limit)){
 const row={id:c.id,instruction:c.instruction,expected:c.expected,freeMiB:freemem()/1048576},start=performance.now();
 try{const p=await planMusic(c.instruction,new AbortController().signal,raw=>row.raw=raw,{...process.env,AI_PROVIDER:'ollama',AI_MODEL:'qwen3:0.6b'});row.actual=p.intent;row.status=c.expected&&p.intent.artist===c.expected.artist&&p.intent.latest===c.expected.latest?'PASS':'FAIL'}
 catch(e){row.reason=e.message;row.status=c.expected===null&&['invalid-model-plan','invalid'].includes(e.message)?'PASS':['model-memory','model-busy','model-not-configured','model-stop-unverified','model-unavailable'].includes(e.message)?'BLOCKED':'FAIL'}
 row.modelOutputObserved=typeof row.raw==='string';row.elapsedMs=Math.round(performance.now()-start);report.rows.push(row);report[row.status==='PASS'?'pass':row.status==='FAIL'?'fail':'blocked']++;await fs.writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(row));
 if(row.status==='BLOCKED')break;
}
report.executed=report.rows.length;report.notRun=cases.length-report.rows.length;await fs.writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({output:out.pathname,pass:report.pass,fail:report.fail,blocked:report.blocked,notRun:report.notRun,weightsTrained:false}));
