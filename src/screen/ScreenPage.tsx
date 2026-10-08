import { useCallback, useEffect, useRef, useState } from 'react'
import {offerFrame} from '../ocr/handoff'
import Brand from '../Brand'
import { localBackendUrl } from '../workspace/transport'
import './screen.css'
type Frame = { blob:Blob; frameId:string; url: string; capturedAt: number; sourceId: string; sequence: number; surface:'window'|'browser'|'monitor'; originalWidth: number; originalHeight: number; width: number; height: number }
export default function ScreenPage() {
 const local=!!localBackendUrl(location.hostname,import.meta.env.VITE_BACKEND_URL)
 const supported=!!navigator.mediaDevices?.getDisplayMedia
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),epoch=useRef(0),alive=useRef(true),frameRef=useRef<Frame|null>(null),sourceId=useRef(''),sequence=useRef(0),geometry=useRef(0),acceptedSurface=useRef<'window'|'browser'|'monitor'|null>(null)
 const [scope,setScope]=useState<'window'|'monitor'>('window'),[monitorApproved,setMonitorApproved]=useState(false)
 const [status,setStatus]=useState('ยังไม่ได้แชร์'),[pending,setPending]=useState(false),[sharing,setSharing]=useState(false),[frame,setFrame]=useState<Frame|null>(null),[now,setNow]=useState(performance.now()),[message,setMessage]=useState('')
 const clearFrame=useCallback((update=true)=>{geometry.current++;if(frameRef.current)URL.revokeObjectURL(frameRef.current.url);frameRef.current=null;if(update&&alive.current)setFrame(null)},[])
 const stop=useCallback((update=true)=>{epoch.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;acceptedSurface.current=null;if(video.current)video.current.srcObject=null;clearFrame(update);if(update&&alive.current){setPending(false);setSharing(false);setMonitorApproved(false);setStatus('หยุดแชร์แล้ว');setMessage('ภาพถูกล้างจากหน้านี้แล้ว')}},[clearFrame])
 useEffect(()=>{alive.current=true;const leaving=()=>{if(location.hash!=='#/screen'){alive.current=false;stop(false)}};const unload=()=>stop(false);addEventListener('hashchange',leaving);addEventListener('beforeunload',unload);return()=>{alive.current=false;stop(false);removeEventListener('hashchange',leaving);removeEventListener('beforeunload',unload)}},[stop])
 useEffect(()=>{if(!frame)return;const timer=setInterval(()=>setNow(performance.now()),1000);return()=>clearInterval(timer)},[frame])
 async function share(){
  if(!local||!supported||pending||sharing||(scope==='monitor'&&!monitorApproved))return
  const token=++epoch.current;clearFrame();setPending(true);setMessage('');setStatus(scope==='monitor'?'รอคุณเลือกจอในเบราว์เซอร์':'รอคุณเลือกหน้าต่างในเบราว์เซอร์')
  let selected:MediaStream|null=null
  try{
   selected=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:scope==='monitor'?'monitor':'window',width:{ideal:1280,max:1920},height:{ideal:720,max:1080},frameRate:{ideal:2,max:2}},audio:false})
   if(!alive.current||token!==epoch.current){selected.getTracks().forEach(track=>track.stop());return}
   const track=selected.getVideoTracks()[0]
   if(!track||track.readyState!=='live'||selected.getAudioTracks().length){selected.getTracks().forEach(t=>t.stop());throw Error('invalid-stream')}
   const surface=track.getSettings().displaySurface;if(surface!=='window'&&surface!=='browser'&&surface!=='monitor'){selected.getTracks().forEach(t=>t.stop());throw Error('source-unknown')}
   if(scope==='window'&&surface==='monitor'){selected.getTracks().forEach(t=>t.stop());throw Error('monitor')}
   if(scope==='monitor'&&surface!=='monitor'){selected.getTracks().forEach(t=>t.stop());throw Error('scope-mismatch')}
   stream.current=selected;acceptedSurface.current=surface;sourceId.current=crypto.randomUUID();sequence.current=0
   track.addEventListener('ended',()=>{if(stream.current===selected)stop()},{once:true})
   if(video.current){video.current.srcObject=selected;await video.current.play()}
   if(!alive.current||token!==epoch.current){selected.getTracks().forEach(t=>t.stop());return}
   setSharing(true);setStatus('กำลังแชร์ให้คุณดูตัวอย่าง');setMessage('แหล่งที่เบราว์เซอร์รายงาน: '+(surface==='monitor'?'ทั้งจอที่คุณเลือก':surface==='window'?'หน้าต่าง':'แท็บ')+' · ยังไม่ยืนยัน OS identity · ถ่ายเฟรมแล้วเลือก OCR เองได้ ไม่มีการคลิกหรือพิมพ์')
  }catch(error){
   selected?.getTracks().forEach(t=>t.stop())
   if(alive.current&&token===epoch.current){stream.current=null;acceptedSurface.current=null;if(video.current)video.current.srcObject=null;setSharing(false);setMonitorApproved(false);setStatus('ไม่ได้เริ่มแชร์');setMessage(error instanceof Error&&error.message==='monitor'?'กรุณาเลือกเฉพาะหน้าต่างหรือแท็บ ไม่แชร์ทั้งจอ':error instanceof Error&&error.message==='scope-mismatch'?'แหล่งที่เลือกไม่ตรงกับโหมดทั้งจอ จึงหยุดแล้ว กรุณาตรวจโหมดและเลือกใหม่':error instanceof Error&&error.message==='source-unknown'?'เบราว์เซอร์ไม่ยืนยันชนิดแหล่ง จึงหยุดแชร์ กรุณาใช้หน้าต่างหรือแท็บที่รองรับ':error instanceof DOMException&&error.name==='NotAllowedError'?'คุณยกเลิกหรือไม่ได้ให้สิทธิ์แชร์ เลือกใหม่ได้':'เปิดภาพไม่ได้ ไม่มีการเก็บหรือส่งภาพ')}
  }finally{if(alive.current&&token===epoch.current)setPending(false)}
 }
 async function snapshot(){
  const element=video.current,active=stream.current,token=epoch.current
  if(!element||!active||!sharing||active.getVideoTracks()[0]?.readyState!=='live')return
  const surface=acceptedSurface.current;if(!surface||active.getVideoTracks()[0].getSettings().displaySurface!==surface){stop();setMessage('ชนิดแหล่งภาพเปลี่ยน จึงหยุดและล้างภาพ กรุณาเลือกใหม่');return}
  const w=element.videoWidth,h=element.videoHeight,frameGeometry=++geometry.current
  if(!w||!h||w>8192||h>8192||w*h>33554432){setMessage('ภาพยังไม่พร้อมหรือใหญ่เกินขอบเขต กรุณาเลือกหน้าต่างขนาดเล็กลง');return}
  const scale=Math.min(1,1280/w,720/h),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));const context=canvas.getContext('2d');if(!context){setMessage('เบราว์เซอร์สร้างภาพตัวอย่างไม่ได้');return}
  try{const capturedAt=performance.now();context.drawImage(element,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'))
   if(!blob||!alive.current||token!==epoch.current||stream.current!==active||frameGeometry!==geometry.current||element.videoWidth!==w||element.videoHeight!==h)return
   if(active.getVideoTracks()[0].getSettings().displaySurface!==surface){stop();setMessage('ชนิดแหล่งภาพเปลี่ยนระหว่างถ่าย จึงหยุดและล้างภาพ กรุณาเลือกใหม่');return}
   if(performance.now()-capturedAt>=10000){setMessage('ภาพถ่ายเสร็จช้าเกินขอบเขต กรุณาถ่ายใหม่');return}clearFrame();const next={url:URL.createObjectURL(blob),blob,frameId:crypto.randomUUID(),capturedAt,sourceId:sourceId.current,sequence:++sequence.current,surface,originalWidth:w,originalHeight:h,width:canvas.width,height:canvas.height};frameRef.current=next;setFrame(next);setNow(performance.now());setMessage('ภาพหนึ่งเฟรมอยู่ในหน่วยความจำของหน้านี้ ไม่ได้ส่งเข้าแชตหรือบันทึกลงดิสก์')
  }catch{if(alive.current&&token===epoch.current)setMessage('ถ่ายภาพไม่สำเร็จ ลองใหม่หรือหยุดแชร์ได้')}
 }
 const age=frame?Math.max(0,Math.floor((now-frame.capturedAt)/1000)):0
 return <div className="cic-screen"><header><Brand href="#/app"/><a href="#/app">กลับแชต</a></header><main><h1>แชร์ภาพหน้าจอ · อ่านอย่างเดียว</h1><p>คุณเลือกแหล่งผ่านเบราว์เซอร์เองครั้งละหนึ่งแหล่ง ภาพใช้แสดงตัวอย่างให้คุณตรวจเท่านั้น เลือกแท็บจะเห็นเฉพาะแท็บนั้น หากต้องเปลี่ยนแหล่งให้หยุดแล้วเลือกใหม่</p><p className="limits">AI ไม่รับภาพโดยตรง ถ่ายเฟรมแล้วเลือกอ่านผ่านหน้า OCR ได้ และไม่มีการควบคุมเครื่อง เสียงสองทางยังอยู่ระหว่างเลือกเครื่องมือ</p>
 {!local&&<p>เว็บสาธารณะเป็น demo เปิด CIC ในเครื่องเพื่อทดลองแชร์ ไม่มีการเรียก backend จากหน้านี้</p>}{local&&!supported&&<p>เบราว์เซอร์นี้ไม่มี API แชร์หน้าต่างที่รองรับ</p>}
 <fieldset disabled={!local||!supported||pending||sharing}><legend>ขอบเขตภาพที่คุณอนุญาต</legend><label><input type="radio" name="screen-scope" checked={scope==='window'} onChange={()=>{setScope('window');setMonitorApproved(false);clearFrame()}}/>หน้าต่างหรือแท็บ (ค่าเริ่มต้น)</label><label><input type="radio" name="screen-scope" checked={scope==='monitor'} onChange={()=>{setScope('monitor');setMonitorApproved(false);clearFrame()}}/>ทั้งจอแบบอ่านอย่างเดียว</label>{scope==='monitor'&&<><p>ทั้งจออาจเห็นข้อมูลส่วนตัวจากทุกแอปที่อยู่บนจอที่เลือก รวมการแจ้งเตือน ตรวจและปิดข้อมูลที่ไม่ต้องการแชร์ด้วยตนเอง ภาพย่ออาจอ่านตัวเล็กไม่ชัด ไม่จับจออื่นอัตโนมัติและไม่ใช้พิกัดนี้ควบคุมเครื่อง</p><label><input type="checkbox" checked={monitorApproved} onChange={e=>setMonitorApproved(e.target.checked)}/>ฉันอนุญาตให้แสดงทั้งจอที่เลือกในรอบนี้ และจะตรวจภาพก่อนถ่ายเฟรมหรือ OCR</label></>}</fieldset>
 <div className="actions"><button onClick={()=>void share()} disabled={!local||!supported||pending||sharing||(scope==='monitor'&&!monitorApproved)}>{scope==='monitor'?'เลือกจอที่อนุญาต':'เลือกหน้าต่างหรือแท็บ'}</button><button onClick={()=>stop()} disabled={!pending&&!sharing}>หยุดแชร์และล้างภาพ</button><button onClick={()=>void snapshot()} disabled={!sharing||pending}>ถ่ายภาพหนึ่งเฟรม</button><button onClick={()=>clearFrame()} disabled={!frame}>ล้างภาพหนึ่งเฟรม</button></div>
 <p role="status" aria-live="polite">{status}{message?' · '+message:''}</p><video ref={video} muted playsInline aria-label="ภาพจากแหล่งที่คุณเลือก" onResize={()=>clearFrame()} />
 {frame&&<section aria-label="ภาพหนึ่งเฟรม"><h2>ภาพที่คุณตรวจ</h2><p>เฟรม {frame.sequence} · อายุ {age} วินาที{age>=10?' · ภาพเก่า กรุณาถ่ายใหม่ก่อนนำไปวิเคราะห์':''}</p><p>แหล่ง {frame.surface==='monitor'?'ทั้งจอที่เลือก':frame.surface==='window'?'หน้าต่าง':'แท็บ'} · ต้นฉบับสตรีม {frame.originalWidth}×{frame.originalHeight} → ตัวอย่าง {frame.width}×{frame.height} พิกัดนี้ยังใช้คลิกหน้าต่างจริงไม่ได้</p><button disabled={age>=10} onClick={()=>{offerFrame({blob:frame.blob,source:{kind:'screen-frame',sourceId:frame.sourceId,frameId:frame.frameId},capturedMono:frame.capturedAt,surface:frame.surface,originalWidth:frame.originalWidth,originalHeight:frame.originalHeight});location.hash='#/ocr'}}>อ่านเฟรมนี้ด้วย OCR</button><p>เฟรมเป็นภาพนิ่งที่คุณเลือก ยังไม่รับรองหน้าต่าง OS หรือพิกัดควบคุมเครื่อง</p><img src={frame.url} alt="ภาพหนึ่งเฟรมจากแหล่งที่คุณเลือก"/></section>}
 <p className="limits">ไม่มีการขอเสียงจากหน้าต่าง ไม่อัปโหลดภาพ ไม่เก็บประวัติภาพ รีเฟรช ออกจากหน้า หรือหยุดแชร์จะหยุดแทร็กและล้างภาพ หากยังอยู่ในหน้าต่างเลือกของเบราว์เซอร์ คุณต้องปิดตัวเลือกนั้นเอง ผลเลือกที่มาช้าจะถูกหยุดทันที</p></main></div>
}
