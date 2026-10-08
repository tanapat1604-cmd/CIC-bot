import { useCallback, useEffect, useRef, useState } from 'react'
import Brand from '../Brand'
import { localBackendUrl } from '../workspace/transport'
import './screen.css'
type Frame = { url: string; capturedAt: number; sourceId: string; sequence: number; originalWidth: number; originalHeight: number; width: number; height: number }
export default function ScreenPage() {
 const local=!!localBackendUrl(location.hostname,import.meta.env.VITE_BACKEND_URL)
 const supported=!!navigator.mediaDevices?.getDisplayMedia
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),epoch=useRef(0),alive=useRef(true),frameRef=useRef<Frame|null>(null),sourceId=useRef(''),sequence=useRef(0),geometry=useRef(0)
 const [status,setStatus]=useState('ยังไม่ได้แชร์'),[pending,setPending]=useState(false),[sharing,setSharing]=useState(false),[frame,setFrame]=useState<Frame|null>(null),[now,setNow]=useState(Date.now()),[message,setMessage]=useState('')
 const clearFrame=useCallback((update=true)=>{geometry.current++;if(frameRef.current)URL.revokeObjectURL(frameRef.current.url);frameRef.current=null;if(update&&alive.current)setFrame(null)},[])
 const stop=useCallback((update=true)=>{epoch.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;clearFrame(update);if(update&&alive.current){setPending(false);setSharing(false);setStatus('หยุดแชร์แล้ว');setMessage('ภาพถูกล้างจากหน้านี้แล้ว')}},[clearFrame])
 useEffect(()=>{alive.current=true;const leaving=()=>{if(location.hash!=='#/screen'){alive.current=false;stop(false)}};const unload=()=>stop(false);addEventListener('hashchange',leaving);addEventListener('beforeunload',unload);return()=>{alive.current=false;stop(false);removeEventListener('hashchange',leaving);removeEventListener('beforeunload',unload)}},[stop])
 useEffect(()=>{if(!frame)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[frame])
 async function share(){
  if(!local||!supported||pending||sharing)return
  const token=++epoch.current;clearFrame();setPending(true);setMessage('');setStatus('รอคุณเลือกหน้าต่างในเบราว์เซอร์')
  let selected:MediaStream|null=null
  try{
   selected=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1280,max:1920},height:{ideal:720,max:1080},frameRate:{ideal:2,max:2}},audio:false})
   if(!alive.current||token!==epoch.current){selected.getTracks().forEach(track=>track.stop());return}
   const track=selected.getVideoTracks()[0]
   if(!track||track.readyState!=='live'||selected.getAudioTracks().length){selected.getTracks().forEach(t=>t.stop());throw Error('invalid-stream')}
   if(track.getSettings().displaySurface==='monitor'){selected.getTracks().forEach(t=>t.stop());throw Error('monitor')}
   stream.current=selected;sourceId.current=crypto.randomUUID();sequence.current=0
   track.addEventListener('ended',()=>{if(stream.current===selected)stop()},{once:true})
   if(video.current){video.current.srcObject=selected;await video.current.play()}
   if(!alive.current||token!==epoch.current){selected.getTracks().forEach(t=>t.stop());return}
   setSharing(true);setStatus('กำลังแชร์ให้คุณดูตัวอย่าง');setMessage('ยังไม่มี OCR หรือ AI อ่านภาพ และไม่มีการคลิกหรือพิมพ์')
  }catch(error){
   selected?.getTracks().forEach(t=>t.stop())
   if(alive.current&&token===epoch.current){stream.current=null;if(video.current)video.current.srcObject=null;setSharing(false);setStatus('ไม่ได้เริ่มแชร์');setMessage(error instanceof Error&&error.message==='monitor'?'กรุณาเลือกเฉพาะหน้าต่างหรือแท็บ ไม่แชร์ทั้งจอ':error instanceof DOMException&&error.name==='NotAllowedError'?'คุณยกเลิกหรือไม่ได้ให้สิทธิ์แชร์ เลือกใหม่ได้':'เปิดภาพไม่ได้ ไม่มีการเก็บหรือส่งภาพ')}
  }finally{if(alive.current&&token===epoch.current)setPending(false)}
 }
 async function snapshot(){
  const element=video.current,active=stream.current,token=epoch.current
  if(!element||!active||!sharing||active.getVideoTracks()[0]?.readyState!=='live')return
  const w=element.videoWidth,h=element.videoHeight,frameGeometry=++geometry.current
  if(!w||!h||w>8192||h>8192||w*h>33554432){setMessage('ภาพยังไม่พร้อมหรือใหญ่เกินขอบเขต กรุณาเลือกหน้าต่างขนาดเล็กลง');return}
  const scale=Math.min(1,1280/w,720/h),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));const context=canvas.getContext('2d');if(!context){setMessage('เบราว์เซอร์สร้างภาพตัวอย่างไม่ได้');return}
  try{context.drawImage(element,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'))
   if(!blob||!alive.current||token!==epoch.current||stream.current!==active||frameGeometry!==geometry.current||element.videoWidth!==w||element.videoHeight!==h)return
   clearFrame();const next={url:URL.createObjectURL(blob),capturedAt:Date.now(),sourceId:sourceId.current,sequence:++sequence.current,originalWidth:w,originalHeight:h,width:canvas.width,height:canvas.height};frameRef.current=next;setFrame(next);setNow(Date.now());setMessage('ภาพหนึ่งเฟรมอยู่ในหน่วยความจำของหน้านี้ ไม่ได้ส่งเข้าแชตหรือบันทึกลงดิสก์')
  }catch{if(alive.current&&token===epoch.current)setMessage('ถ่ายภาพไม่สำเร็จ ลองใหม่หรือหยุดแชร์ได้')}
 }
 const age=frame?Math.max(0,Math.floor((now-frame.capturedAt)/1000)):0
 return <div className="cic-screen"><header><Brand href="#/app"/><a href="#/app">กลับแชต</a></header><main><h1>แชร์หน้าต่าง · อ่านอย่างเดียว</h1><p>คุณเลือกหน้าต่างหรือแท็บผ่านเบราว์เซอร์ ภาพใช้แสดงตัวอย่างให้คุณตรวจเท่านั้น</p><p className="limits">ยังไม่มี AI อ่านภาพ ไม่มี OCR ในหน้านี้ และไม่มีการควบคุมเครื่อง เสียงสองทางยังอยู่ระหว่างเลือกเครื่องมือ</p>
 {!local&&<p>เว็บสาธารณะเป็น demo เปิด CIC ในเครื่องเพื่อทดลองแชร์ ไม่มีการเรียก backend จากหน้านี้</p>}{local&&!supported&&<p>เบราว์เซอร์นี้ไม่มี API แชร์หน้าต่างที่รองรับ</p>}
 <div className="actions"><button onClick={()=>void share()} disabled={!local||!supported||pending||sharing}>เลือกหน้าต่างหรือแท็บ</button><button onClick={()=>stop()} disabled={!pending&&!sharing}>หยุดแชร์และล้างภาพ</button><button onClick={()=>void snapshot()} disabled={!sharing||pending}>ถ่ายภาพหนึ่งเฟรม</button><button onClick={()=>clearFrame()} disabled={!frame}>ล้างภาพหนึ่งเฟรม</button></div>
 <p role="status" aria-live="polite">{status}{message?' · '+message:''}</p><video ref={video} muted playsInline aria-label="ภาพหน้าต่างที่คุณเลือก" onResize={()=>clearFrame()} />
 {frame&&<section aria-label="ภาพหนึ่งเฟรม"><h2>ภาพที่คุณตรวจ</h2><p>เฟรม {frame.sequence} · อายุ {age} วินาที{age>=10?' · ภาพเก่า กรุณาถ่ายใหม่ก่อนนำไปวิเคราะห์':''}</p><p>ต้นฉบับ {frame.originalWidth}×{frame.originalHeight} → ตัวอย่าง {frame.width}×{frame.height} พิกัดนี้ยังใช้คลิกหน้าต่างจริงไม่ได้</p><img src={frame.url} alt="ภาพหนึ่งเฟรมจากหน้าต่างที่คุณเลือก"/></section>}
 <p className="limits">ไม่มีการขอเสียงจากหน้าต่าง ไม่อัปโหลดภาพ ไม่เก็บประวัติภาพ รีเฟรช ออกจากหน้า หรือหยุดแชร์จะหยุดแทร็กและล้างภาพ หากยังอยู่ในหน้าต่างเลือกของเบราว์เซอร์ คุณต้องปิดตัวเลือกนั้นเอง ผลเลือกที่มาช้าจะถูกหยุดทันที</p></main></div>
}
