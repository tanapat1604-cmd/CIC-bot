import {useCallback,useEffect,useRef,useState} from 'react'
import type {VoicePhrase} from '../../shared/voice'
import {parseChromeResearchJob,type ChromeResearchJob} from '../../shared/chromeObservation'
type Props={noteAppend?:boolean;onJob?:(job:ChromeResearchJob)=>void;sessionGranted?:boolean;grantSession?:()=>Promise<boolean>;speak?:(phrase:VoicePhrase)=>Promise<void>;instruction:string;request:(path:string,body?:unknown)=>Promise<unknown>;onBusy:(value:boolean)=>void;registerStop:(stop:()=>Promise<boolean>)=>void;onMessage?:(message:string)=>void}
export default function ChromeResearchPanel({noteAppend=false,onJob,sessionGranted=false,grantSession,speak,instruction,request,onBusy,registerStop,onMessage}:Props){
 const spoken=useRef<string|null>(null),approving=useRef(false)
 const alive=useRef(false),epoch=useRef(0),operation=useRef<string|null>(null)
 const[job,setJob]=useState<ChromeResearchJob|null>(null),[message,setMessage]=useState('กำลังทำความเข้าใจคำขอของคุณ'),[deadline,setDeadline]=useState(0)
 const cancel=useCallback(async()=>{epoch.current++;const op=operation.current;if(!op){if(alive.current)onBusy(false);return true}try{const ack=await request('/chrome/operations/'+op+'/cancel',{}) as {acknowledged?:boolean};if(!ack.acknowledged)throw Error('stop-unverified');const settled=await request('/chrome/stop',{}) as {settled?:boolean};if(settled.settled!==true)throw Error('stop-unverified');operation.current=null;if(alive.current){setJob(null);setMessage('หยุดงานค้นหาแล้ว ไม่ปิด Chrome ของคุณ');onBusy(false)}return true}catch{if(alive.current){setMessage('ยังตรวจการหยุดงานค้นหาไม่ได้');onBusy(true)}return false}},[request,onBusy])
 useEffect(()=>{registerStop(cancel)},[registerStop,cancel])
 useEffect(()=>{
  alive.current=true;const token=++epoch.current
  // Defer one tick so a development StrictMode cleanup cannot issue a request.
  const timer=setTimeout(()=>{if(token!==epoch.current)return;const op=crypto.randomUUID();operation.current=op;onBusy(true);void request('/chrome/plans',{version:1,operationId:op,instruction}).then(parseChromeResearchJob).then(j=>{if(alive.current&&token===epoch.current){if(j.state==='waiting-permission')setDeadline(Date.now()+30000);setJob(j);onJob?.(j)}else void request('/chrome/operations/'+op+'/cancel',{})}).catch(()=>{if(alive.current&&token===epoch.current){setMessage('ยังเตรียมงานค้นหาไม่ได้ กดหยุดแล้วลองใหม่');onBusy(false)}})},0)
  return()=>{clearTimeout(timer);alive.current=false;void cancel()}
 },[instruction,request,onBusy,cancel,onJob])
 useEffect(()=>{onMessage?.(message)},[message,onMessage])
 useEffect(()=>{
  if(!job||!['planning','waiting-permission','queued','running','cancelling'].includes(job.state))return
  let disposed=false,busy=false;const token=epoch.current,timer=setInterval(()=>{if(busy)return;busy=true;void request('/chrome/jobs/'+job.taskId).then(parseChromeResearchJob).then(j=>{
   if(disposed||!alive.current||token!==epoch.current)return
   if(j.taskId!==job.taskId||j.operationId!==job.operationId)throw Error('protocol')
   setJob(j);onJob?.(j)
   if(j.state==='waiting-permission'){if(job.state!=='waiting-permission')setDeadline(Date.now()+30000);setMessage('ฉันจะค้นหา “'+j.query+'” '+(j.windowMode==='cic-reuse'?'ใน Chrome ของ CiC โดยใช้แท็บเดิมถ้าเปิดอยู่':'ใน Chrome หน้าต่างใหม่')+' แล้วอ่านผลที่แสดง');onBusy(false)}
   else if(j.state==='running')setMessage(j.windowMode==='cic-reuse'?'กำลังใช้แท็บ Chrome ของ CiC และอ่านผลค้นหา':'กำลังเปิด Chrome และอ่านผลค้นหา')
   else if(j.state==='succeeded'){setMessage(j.result?.selectedTitle?'เปิดผลค้นหาและอ่านแล้ว แหล่งที่ฉันแนะนำ: '+j.result.selectedTitle:'เปิดผลค้นหาและอ่านแล้ว ยังเลือกแหล่งข้อมูลที่มั่นใจไม่ได้');onBusy(false);if(speak&&spoken.current!==j.taskId){spoken.current=j.taskId;void speak('opened')}}
   else if(['failed','cancelled','stop-unverified'].includes(j.state)){setMessage(j.reason==='human-required'?'เว็บไซต์ขอให้คุณยืนยันใน Chrome ก่อน ลองค้นอีกครั้งหลังยืนยันแล้ว':j.reason==='chrome-previous-window-unverified'?'Chrome จากรอบก่อนยังตรวจยืนยันไม่ได้ จึงยังไม่เปิดเพิ่ม':j.reason==='unsupported-request'?'คำขอนี้อยู่นอกสิทธิ์ค้นหาและอ่านเว็บ ยังไม่ได้ทำตามคำสั่ง':['chrome-window-closed','chrome-window-changed','chrome-owner-conflict'].includes(j.reason??'')?'ยังใช้หน้าต่างเดิมไม่ได้ ตรวจหน้าต่างของ CiC แล้วบอกเปิด Chrome อีกครั้ง ไม่มีการเปิดใหม่เอง':j.reason==='needs-clarification'?'ยังแยกงานนี้ไม่ชัด ลองบอกเรื่องที่อยากค้นหา':j.state==='stop-unverified'?'ยังตรวจการหยุดงานค้นหาไม่ได้':'งานค้นหายุติ: '+(j.reason??j.state));onBusy(j.state==='stop-unverified');if(speak&&spoken.current!==j.taskId){spoken.current=j.taskId;void speak(j.reason==='needs-clarification'||j.reason==='unsupported-request'?'clarify':'failed')}}
  }).catch(()=>{if(alive.current&&token===epoch.current){setMessage('อ่านสถานะงานค้นหาไม่ได้ กดหยุดเพื่อตรวจบริการ');onBusy(true)}}).finally(()=>busy=false)},150)
  return()=>{disposed=true;clearInterval(timer)}
 },[job,request,onBusy,speak,onJob])
 async function approve(automatic=false){if(approving.current)return;if(!job||job.state!=='waiting-permission')return;if(Date.now()>deadline){await cancel();return}approving.current=true;const token=epoch.current;onBusy(true);setMessage('กำลังเริ่มงานที่คุณอนุญาต');try{if(!automatic&&grantSession&&!sessionGranted&&!await grantSession())throw Error('permission-denied');if(!alive.current||token!==epoch.current)return;const latest=parseChromeResearchJob(await request('/chrome/jobs/'+job.taskId));if(!alive.current||token!==epoch.current)return;const j=latest.state==='waiting-permission'?parseChromeResearchJob(await request('/chrome/jobs/'+job.taskId+(automatic||grantSession?'/session-approve':'/approve'),{})):latest;if(alive.current&&token===epoch.current)setJob(j)}catch{if(alive.current&&token===epoch.current){setMessage('เริ่มงานไม่ได้ กดหยุดแล้วลองใหม่');onBusy(false)}}finally{approving.current=false}}
 const approveRef=useRef(approve);approveRef.current=approve
 useEffect(()=>{if(sessionGranted&&job?.state==='waiting-permission')void approveRef.current(true)},[sessionGranted,job?.state])
 return <section className="voice-conversation-reply" aria-label="คำตอบ CiC"><p role="log" aria-label="สถานะคำสั่งเสียง">{message}</p><p className="voice-heard">คำขอของคุณ: “{instruction}”</p>{job?.state==='waiting-permission'&&!sessionGranted&&<div className="voice-grant"><p>อนุญาตเปิด Notepad, Chrome, YouTube และค้นหา/อ่านผลใน Chrome {noteAppend?'รวมถึงพิมพ์ข้อความที่สั่งเฉพาะ Notepad ของ CiC ':''}ระหว่างใช้งาน หยุดพักแล้วคุยต่อได้ คำขอต่อไปทำอัตโนมัติ ยังไม่รวมส่งข้อมูลในเว็บ</p><button onClick={()=>void approve()}>อนุญาตใช้แอปครั้งเดียว</button><button onClick={()=>void cancel()}>ไม่ต้อง</button></div>}</section>
}
