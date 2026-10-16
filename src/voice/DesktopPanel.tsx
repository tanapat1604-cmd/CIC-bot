import {useCallback,useEffect,useRef,useState} from 'react'
import type {DesktopObservation,DesktopWindow} from '../../backend/desktop/native'
export type DesktopReply={text:string;completedAt?:number;elapsedMs?:number;verified:boolean}
export type DesktopExecutor=(text:string)=>Promise<DesktopReply|null>
export default function DesktopPanel({busy,request,ensureConnected,register}:{busy:boolean;request:(path:string,body?:unknown)=>Promise<unknown>;ensureConnected:()=>Promise<boolean>;register:(handler:DesktopExecutor)=>void}){
 const[working,setWorking]=useState(false),[windows,setWindows]=useState<DesktopWindow[]>([]),[observation,setObservation]=useState<DesktopObservation|null>(null),[message,setMessage]=useState(''),[owned,setOwned]=useState(false)
 const running=useRef(false),current=useRef<DesktopObservation|null>(null),permission=useRef(false);current.current=observation;permission.current=owned
 async function begin(){setWorking(true);try{try{await request('/voice/status')}catch{if(!await ensureConnected())throw Error('ยังเชื่อม CiC ไม่ได้')}const result=await request('/desktop/begin',{version:1,operationId:crypto.randomUUID(),acknowledged:true}) as {windows:DesktopWindow[]};setWindows(result.windows);setOwned(true);setMessage('เลือกหน้าต่างที่ต้องการคุม ใช้หน้าต่างเดิมของคุณ')}catch(e){setMessage((e as Error).message)}finally{setWorking(false)}}
 async function select(windowId:string){if(!windowId)return;setWorking(true);try{const result=await request('/desktop/select',{windowId,operationId:crypto.randomUUID()}) as DesktopObservation;setObservation(result);setMessage('คุมหน้าต่าง '+result.title+' แล้ว คำสั่งคลิกและพิมพ์จะทำในหน้าต่างนี้')}catch(e){setMessage((e as Error).message)}finally{setWorking(false)}}
 async function stop(){setWorking(true);try{const result=await request('/desktop/stop',{}) as {settled:boolean};if(!result.settled)throw Error('ยังยืนยันการหยุดตัวควบคุมไม่ได้');setOwned(false);setObservation(null);setWindows([]);setMessage('หยุดตัวควบคุมแล้ว หน้าต่างและข้อความของคุณยังอยู่')}catch(e){setMessage((e as Error).message)}finally{setWorking(false)}}
 const execute=useCallback<DesktopExecutor>(async raw=>{
  const siteText=raw.normalize('NFC').trim();
  const siteOpen=/^(?:ช่วย\s*)?เปิด(?:เว็บ|แอป)?\s*(?:TikTok|ติ๊กต็อก|ติ๊กต๊อก|ติ๊กตอก|ติกตอก)\s*(?:ให้หน่อย|หน่อย)?\s*(?:ครับ|ค่ะ|นะ)?$/iu.test(siteText);
  const siteScroll=/^(?:ช่วย\s*)?เลื่อน(?:ลง)?\s*(?:TikTok|ติ๊กต็อก|ติ๊กต๊อก|ติ๊กตอก|ติกตอก)(?:\s*ลง)?\s*(?:ให้หน่อย|หน่อย)?\s*(?:ครับ|ค่ะ|นะ)?$/iu.test(siteText);
  const siteAction=siteOpen?'open':siteScroll?'scroll':null;
  if(siteAction){
   if(running.current)return{text:'ตัวควบคุมกำลังทำงานก่อนหน้า',verified:false};running.current=true;setWorking(true);
   try{try{await request('/voice/status')}catch{if(!await ensureConnected())throw Error('ยังเชื่อม CiC ไม่ได้')}
    const result=await request('/desktop/tiktok',{version:1,operationId:crypto.randomUUID(),acknowledged:true,action:siteAction}) as {after:DesktopObservation;elapsedMs:number;taskCompletionVerified:boolean;nextVideoVerified?:boolean};setOwned(true);setObservation(result.after);
    const text=siteAction==='open'?'ส่งคำขอเปิด TikTok ในแท็บใหม่ของ Chrome เดิมแล้ว':result.nextVideoVerified?'เปลี่ยนคลิป TikTok แล้ว':result.taskCompletionVerified?'เลื่อนหน้า TikTok แล้ว':'ส่งล้อเมาส์แล้ว แต่ยังตรวจว่าหน้าหรือคลิปเลื่อนไม่ได้';setMessage(text);
    return{text,elapsedMs:result.elapsedMs,verified:result.taskCompletionVerified,...(result.taskCompletionVerified?{completedAt:Date.now()}:{})}
   }catch(e){const code=(e as Error).message;if(code==='personal-chrome-ambiguous'){try{const listed=await request('/desktop/windows') as {windows:DesktopWindow[]};setWindows(listed.windows.filter(w=>w.app==='chrome'));setOwned(true)}catch{/* The original failure remains visible. */}}return{text:code==='not-tiktok-page'?'เปิด TikTok ใน Chrome ของคุณก่อนครับ':code.includes('ambiguous')?'พบหลายหน้าต่างหรือตำแหน่ง กรุณาเลือกหน้าต่าง TikTok ให้ชัดครับ':'ยังควบคุม TikTok ไม่สำเร็จ: '+code,verified:false}}
   finally{running.current=false;setWorking(false)}
  }
  const text=raw.normalize('NFC').trim(),click=/^(?:คลิก|กด)(?:\s*ปุ่ม)?\s+(.+)$/u.exec(text),typing=/^พิมพ์บนจอ\s+(.+)$/u.exec(text),namedTyping=/^พิมพ์ใน\s+(.+?)\s+ว่า\s+(.+)$/u.exec(text)
  const windowChoice=/^(?:เลือกหน้าต่าง|คุมหน้าต่าง)\s+(.+)$/u.exec(text)
  const address=/^ใส่ที่อยู่เว็บ\s+(https?:\/\/\S+)$/u.exec(text)
  const browserKey=address?'address':text==='เปิดแท็บใหม่'?'new-tab':text==='กด Enter'?'enter':null
  if(!click&&!typing&&!namedTyping&&!windowChoice&&!browserKey&&text!=='ดูหน้าต่าง'&&text!=='หยุดคุมจอ')return null
  if(text==='หยุดคุมจอ'){try{const result=await request('/desktop/stop',{}) as {settled:boolean};if(!result.settled)throw Error('หยุดยังไม่ยืนยัน');setOwned(false);setObservation(null);setWindows([]);return{text:'หยุดตัวควบคุมแล้ว',verified:true,completedAt:Date.now()}}catch(e){return{text:(e as Error).message,verified:false}}}
  if(windowChoice||text==='ดูหน้าต่าง'){
   if(running.current)return{text:'ตัวควบคุมกำลังทำงานก่อนหน้า',verified:false}
   running.current=true;setWorking(true)
   try{try{await request('/voice/status')}catch{if(!await ensureConnected())throw Error('ยังเชื่อม CiC ไม่ได้')}const result=await request('/desktop/begin',{version:1,operationId:crypto.randomUUID(),acknowledged:true}) as {windows:DesktopWindow[]};setWindows(result.windows);setOwned(true);if(!windowChoice)return{text:result.windows.map(w=>w.app+' — '+w.title).join('\n')||'ยังไม่พบหน้าต่างที่เปิดอยู่',verified:false};const name=windowChoice[1].toLocaleLowerCase(),matches=result.windows.filter(w=>w.title.normalize('NFC').toLocaleLowerCase()===name||w.app.toLocaleLowerCase()===name);if(matches.length!==1)return{text:matches.length?'มีหลายหน้าต่างชื่อนี้ ระบุชื่อเต็มหรือเลือกจากรายการครับ':'ยังไม่พบหน้าต่างชื่อนี้ ลองพูด “ดูหน้าต่าง”',verified:false};const selected=await request('/desktop/select',{windowId:matches[0].windowId,operationId:crypto.randomUUID()}) as DesktopObservation;setObservation(selected);setMessage('คุมหน้าต่าง '+selected.title+' แล้ว');return{text:'เลือกหน้าต่าง '+selected.title+' แล้ว',verified:true,completedAt:Date.now()}}catch(e){return{text:'เลือกหน้าต่างยังไม่สำเร็จ: '+(e as Error).message,verified:false}}finally{running.current=false;setWorking(false)}
  }
  if(!permission.current||!current.current)return{text:'เลือกหน้าต่างใน “คุมหน้าต่าง” ก่อนครับ',verified:false}
  if(running.current)return{text:'ตัวควบคุมกำลังทำงานก่อนหน้า',verified:false}
  running.current=true;setWorking(true)
  try{
   const before=await request('/desktop/observation') as DesktopObservation;if(before.windowId!==current.current.windowId||before.instanceId!==current.current.instanceId)throw Error('หน้าต่างที่เลือกเปลี่ยนแล้ว')
   const edits=before.controls.filter(c=>c.kind==='ControlType.Edit'),documents=before.controls.filter(c=>c.kind==='ControlType.Document')
   const controls=namedTyping?before.controls.filter(c=>c.name.normalize('NFC').toLocaleLowerCase()===namedTyping[1].toLocaleLowerCase()&&(c.kind==='ControlType.Edit'||c.kind==='ControlType.Document')):browserKey?before.controls.filter(c=>before.app==='chrome'&&c.name==='Address and search bar'&&c.kind==='ControlType.Edit'):typing?(edits.length?edits:documents):before.controls.filter(c=>c.name.normalize('NFC').toLocaleLowerCase()===click![1].toLocaleLowerCase())
   if(controls.length!==1)return{text:controls.length?'มีหลายตำแหน่งตรงกัน ระบุชื่อปุ่มหรือช่องให้ชัดครับ':'ยังไม่พบปุ่มหรือช่องที่ระบุในหน้าต่างนี้',verified:false}
   const result=await request('/desktop/action',{version:1,operationId:crypto.randomUUID(),action:browserKey??(typing||namedTyping?'type':'click'),text:address?.[1]??typing?.[1]??namedTyping?.[2]??'',controlId:controls[0].controlId,observationId:before.observationId,geometry:before.geometry}) as {after:DesktopObservation;elapsedMs:number;taskCompletionVerified:boolean}
   setObservation(result.after);const reply=browserKey==='address'&&result.taskCompletionVerified?'ใส่ที่อยู่เว็บและอ่านกลับตรงแล้ว':browserKey==='new-tab'&&result.taskCompletionVerified?'เปิดแท็บใหม่ใน Chrome เดิมแล้ว':browserKey==='enter'?'ส่ง Enter ในช่องแอดเดรสแล้ว ยังต้องตรวจหน้าเว็บ':result.taskCompletionVerified?(typing||namedTyping?'พิมพ์ข้อความที่สั่งแล้ว':'คลิก '+controls[0].name+' แล้ว'):'ส่งคลิกแล้ว แต่ยังไม่ยืนยันผลในหน้าต่าง';setMessage(reply)
   return{text:reply,elapsedMs:result.elapsedMs,...(result.taskCompletionVerified?{completedAt:Date.now()}:{}),verified:result.taskCompletionVerified}
  }catch(e){const reply='ตัวควบคุมยังทำงานนี้ไม่สำเร็จ: '+(e as Error).message;setMessage(reply);return{text:reply,verified:false}}finally{running.current=false;setWorking(false)}
 },[request,ensureConnected])
 useEffect(()=>{register(execute);return()=>register(async()=>null)},[execute,register])
 useEffect(()=>{if(!owned)return;let ended=false;const timer=setInterval(()=>{void request('/desktop/status').then(value=>{const state=value as {held:boolean;owned:boolean;fault:boolean};if(!ended&&!state.owned&&!state.fault){setOwned(false);setObservation(null);setWindows([]);setMessage('หยุดตัวควบคุมแล้ว หน้าต่างยังอยู่')}}).catch(()=>{})},1000);return()=>{ended=true;clearInterval(timer)}},[owned,request])
 return <details className="voice-evidence"><summary>คุมหน้าต่าง</summary><p>ใช้เมาส์และพิมพ์ในหน้าต่างเดิม พูด “ดูหน้าต่าง” และ “เลือกหน้าต่าง ตามด้วยชื่อ” ได้ หยุดฉุกเฉิน Ctrl+Alt+Shift+F11</p><button disabled={busy||working} onClick={()=>void begin()}>{owned?'อ่านรายการหน้าต่างอีกครั้ง':'เชื่อมคุมหน้าต่าง'}</button>{owned&&<button disabled={working} onClick={()=>void stop()}>หยุดคุมหน้าต่าง</button>}{windows.length>0&&<label>หน้าต่างที่จะใช้ <select aria-label="หน้าต่างที่จะควบคุม" disabled={busy||working} value={observation?.windowId??''} onChange={e=>void select(e.target.value)}><option value="">เลือกหน้าต่าง…</option>{windows.map(w=><option key={w.windowId} value={w.windowId}>{w.app} — {w.title} (รหัส {w.pid})</option>)}</select></label>}{observation&&<><p>พูด “คลิก ตามด้วยชื่อปุ่ม” หรือ “พิมพ์บนจอ ตามด้วยข้อความ”</p><ul>{observation.controls.map(c=><li key={c.controlId}>{c.name||'ช่องข้อความ'} <button disabled={busy||working} onClick={()=>void execute('คลิก '+c.name)}>คลิก</button></li>)}</ul></>}{message&&<p role="status">{message}</p>}</details>
}
