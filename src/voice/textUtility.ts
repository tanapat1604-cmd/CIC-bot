import {decodeEvents} from '../workspace/transport'
import {validateRequest} from '../../shared/chatProtocol'
export type UtilityPlan={kind:'help'|'clock'|'calculator'|'time-calculator'|'screen'|'ocr'|'slides'|'chat-guide';instruction:string}
export const UTILITY_PAGES={screen:{href:'#/screen',label:'เลือกหน้าต่างเพื่อแชร์',text:'เลือกหน้าต่างที่ต้องการแชร์ก่อน ฉันยังไม่เห็นหน้าจอคุณ ภาพที่เลือกส่งอ่านตัวอักษรในเครื่องได้'},ocr:{href:'#/ocr',label:'อ่านตัวอักษรจากภาพ',text:'เลือกภาพหรือส่งภาพจากหน้าจอที่คุณแชร์ แล้วตรวจตัวอักษรที่อ่านได้ก่อนใช้ ภาพไม่ได้ส่งไป AI บนคลาวด์'},slides:{href:'#/slides',label:'เตรียมสไลด์',text:'ใส่หัวข้อและเนื้อหา แล้วตรวจร่างก่อนสร้างไฟล์ PPTX/PDF ในเครื่อง ตอนนี้ยังไม่ได้สร้างสไลด์และยังไม่มีแอนิเมชัน'},'chat-guide':{href:'#/app',label:'เปิดแชตข้อความกับ AI',text:'หน้าแชตข้อความมี AI ในเครื่องสำหรับถามตอบ ส่วนการนำ AI หลายตัวมาคุมหน้าคุยนี้กำลังเทียบผล ยังไม่ได้ให้ AI เปิดโปรแกรมเอง'}} as const
export type UtilityReply={text:string;source:UtilityPlan['kind'];elapsedMs:number}
export function textUtilityPlan(raw:string):UtilityPlan|null{
 const text=raw.normalize('NFC').trim();if(text.length>200||[...text].some(c=>c.charCodeAt(0)<32))return null
 if(/^(?:ช่วยอะไรได้บ้าง|ทำอะไรได้บ้าง|ตอนนี้ช่วยอะไรได้บ้าง|what can you do\??|help)$/iu.test(text))return{kind:'help',instruction:text}
 if(/^(?:กี่โมงแล้ว|ตอนนี้กี่โมง|ตอนนี้กี่โมงแล้ว|what time is it\??)$/iu.test(text))return{kind:'clock',instruction:text}
 for(const[kind,pattern]of [['screen',/^(?:ดูหน้าจอ|อ่านหน้าจอ|อ่านข้อความบนจอ)$/u],['ocr',/^(?:อ่านภาพ|อ่านข้อความจากภาพ|ocr)$/iu],['slides',/^(?:ทำสไลด์|สร้างสไลด์|เตรียมสไลด์)$/u],['chat-guide',/^(?:คุยกับเอไอ|แชตกับเอไอ|คุยกับ ai)$/iu]]as const)if(pattern.test(text))return{kind,instruction:text}
 const calc=/^\/calc\s+(.+)$/iu.exec(text)??/^(?:คำนวณ|คิดเลข)\s*(.+?)(?:\s*ให้หน่อย)?$/u.exec(text)
 if(calc){const expression=calc[1].trim();if(expression.length<=128&&/^[\d\s.+\-*/()]+$/u.test(expression))return{kind:'calculator',instruction:'/calc '+expression};return null}
 const time=/^\/time\s+(.+)$/iu.exec(text)
 if(time){const expression=time[1].trim();if(expression.length<=128&&/^\d{2}:\d{2}(?:\s*[+-]\s*\d{1,5})+$/u.test(expression))return{kind:'time-calculator',instruction:'/time '+expression}}
 return null
}
// Text-only entry. These requests never reinterpret microphone text, receive
// app grants, ask a model for tools, or forward file paths / shell syntax.
export async function runTextUtility(plan:UtilityPlan,base:string,signal:AbortSignal,fetcher:typeof fetch=fetch,now=()=>new Date()):Promise<UtilityReply>{
 signal.throwIfAborted();const began=performance.now()
 if(plan.kind in UTILITY_PAGES)return{text:UTILITY_PAGES[plan.kind as keyof typeof UTILITY_PAGES].text,source:plan.kind,elapsedMs:Math.round(performance.now()-began)}
 if(plan.kind==='help')return{text:'ฉันช่วยเตรียมเปิด Chrome, YouTube หรือ Notepad โดยรออนุญาตครั้งเดียว คำนวณตัวเลข บวกเวลา และบอกเวลาปัจจุบันได้ ตอนนี้เสียงพูดยังอยู่ระหว่างปรับให้ฟังถูก',source:'help',elapsedMs:Math.round(performance.now()-began)}
 if(plan.kind==='clock')return{text:'ตอนนี้เวลา '+new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(now())+' น. ตามนาฬิกาเครื่อง',source:'clock',elapsedMs:Math.round(performance.now()-began)}
 const payload=validateRequest({sessionId:crypto.randomUUID(),operationId:crypto.randomUUID(),messages:[{role:'user',text:plan.instruction}]}),combined=AbortSignal.any([signal,AbortSignal.timeout(8000)]),response=await fetcher(base+'/chat',{method:'POST',credentials:'include',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:combined})
 if(!response.ok){await response.body?.cancel();throw Error(response.status===401?'unauthorized':'utility-unavailable')}
 if(!response.headers.get('content-type')?.startsWith('application/x-ndjson')||!response.body)throw Error('protocol')
 let text='',complete=false
 for await(const event of decodeEvents(response.body,payload,combined)){if(event.type==='error'||event.type==='cancelled')throw Error(event.type==='error'?event.code:'cancelled');if(event.source!==plan.kind)throw Error('protocol');if(event.type==='delta')text+=event.text;else complete=true}
 signal.throwIfAborted();if(!complete||!text||text.length>4096)throw Error('protocol');return{text,source:plan.kind,elapsedMs:Math.round(performance.now()-began)}
}
