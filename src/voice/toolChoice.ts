import {notepadInstruction,missingNotepadText} from '../../shared/notepadCommand'
import {explicitChromeQuery,missingChromeQuery} from '../../shared/chromeQuery'
import {assistantKnowledgeReply} from '../../shared/assistantKnowledge'
import {classifyVoiceCommand} from '../../shared/appOpen'
import {textUtilityPlan,type UtilityPlan} from './textUtility'
import {spokenArithmetic,spokenNumber} from '../../shared/spokenArithmetic'
export type MissingSlot='expression'|'app'|'query'|'task'|'notepad-text'
export type ToolQuestion={slot:MissingSlot;question:string;expiresAt:number;arithmetic?:{left?:string;right?:string;operator:string;language:'th'|'en'}}
export type ToolChoice={kind:'answer';message:string}|{kind:'clarify';pending:ToolQuestion}|{kind:'utility';plan:UtilityPlan}|{kind:'app'|'research'|'notepad';instruction:string}|{kind:'unsupported';message:string}
const question=(slot:MissingSlot,now:number):ToolChoice=>({kind:'clarify',pending:{slot,expiresAt:now+60000,question:slot==='task'?'อยากให้ช่วยงานอะไรครับ: คำนวณ ค้นข้อมูล อ่านภาพ/หน้าจอ ทำสไลด์ หรือเปิดโปรแกรม?':slot==='expression'?'ต้องการคำนวณสมการอะไรครับ? เช่น (73-19)*2':slot==='app'?'ต้องการเปิดโปรแกรมไหนครับ: Chrome, YouTube หรือ Notepad?':'ต้องการค้นหาเรื่องอะไรครับ?'}})
// Tool selection is a bounded typed proposal. Existing backend validation and
// consent still authorize each action. A short answer cannot add capabilities.
const typedCommand=(text:string)=>{const command=classifyVoiceCommand(text);if(command.kind!=='decline')return command;const explicit=/^(?:(?:ช่วย|กรุณา|please)\s*)?(?:(?:ไม่(?:ต้อง|อยากให้|ให้)?|อย่า|ห้าม|ไม่อนุญาตให้|do not|don't)\s*(?:เปิด|ปิด|ลบ|ส่ง|เล่น|พิมพ์|ทำ|เตรียม|อ่าน|ซื้อ|โอน|open|prepare|close|delete|send|play|type|read|buy)|(?:ไม่เอา|ไม่อนุญาต|ยกเลิก|ปฏิเสธ|cancel|deny)(?:ทั้งหมด|คำสั่ง|งานนี้|ครับ|ค่ะ|นะ|\s)*$)/iu.test(text);return explicit?command:{kind:'unknown' as const,instruction:command.instruction}}
export function chooseTypedTool(raw:string,pending:ToolQuestion|null=null,now=Date.now(),hasContext=false):ToolChoice{
 const text=raw.normalize('NFC').trim(),command=typedCommand(text)
 if(!text||text.length>200||[...text].some(c=>c.charCodeAt(0)<32))return{kind:'unsupported',message:'กรุณาบอกงานหนึ่งอย่างให้ชัดครับ'}
 const note=notepadInstruction(text);if(note)return{kind:'notepad',instruction:note};if(missingNotepadText(text))return{kind:'clarify',pending:{slot:'notepad-text',question:'ต้องการพิมพ์ข้อความอะไรใน Notepad ของ CiC ครับ?',expiresAt:now+60000}}
 if(command.kind==='stop'||command.kind==='decline')return{kind:'app',instruction:text}
 // A fresh payload question takes precedence over ambiguous bare utility words.
 // Explicit commands, cancellation and unsupported action syntax keep their route.
 if(pending&&pending.expiresAt>now&&['query','notepad-text'].includes(pending.slot)&&command.kind==='unknown'&&!explicitChromeQuery(text)&&!missingChromeQuery(text)&&!/(?:แล้ว|และ)\s*(?:เปิด|ปิด|ลบ|ส่ง|ซื้อ|โอน)/u.test(text)&&!/^(?:(?:ช่วย|กรุณา|please)\s*)?(?:เปิด|ปิด|ลบ|ส่ง|ซื้อ|โอน|คำนวณ|คิดเลข|ทำ|สร้าง|เตรียม|ติดตั้ง|open|close|delete|send|buy|transfer|search|type|\/calc|\/time)/iu.test(text)&&!/[;&|\x60<>]|https?:|www\.|[\\/]/iu.test(text)){
  if(pending.slot==='notepad-text'){const note=notepadInstruction('พิมพ์ใน Notepad '+text);if(note)return{kind:'notepad',instruction:note}}
  else return{kind:'research',instruction:'ค้นหา '+text}
 }

 const work=text.replace(/^(?:อยากให้(?:ช่วย)?|อยาก|ช่วย|กรุณา|please)\s*/iu,'').trim()
 const utility=textUtilityPlan(text)??textUtilityPlan(work)
 if(utility)return{kind:'utility',plan:utility}
 // The spoken text is kept by the caller. Only an exact parsed expression is
 // proposed to the existing literal calculator; never infer from examples.
 if(pending?.slot==='expression'&&pending.expiresAt>now&&pending.arithmetic){const value=spokenNumber(text),a=pending.arithmetic;if(value!==null)return{kind:'utility',plan:{kind:'calculator',instruction:'/calc '+(a.left??value)+' '+a.operator+' '+(a.right??value)}}}
 const spoken=spokenArithmetic(work,pending?.slot==='expression'&&pending.expiresAt>now)
 if(spoken?.kind==='complete')return{kind:'utility',plan:{kind:'calculator',instruction:'/calc '+spoken.expression}}
 if(spoken?.kind==='missing')return{kind:'clarify',pending:{slot:'expression',question:spoken.question,expiresAt:now+60000,...(spoken.operator!==undefined?{arithmetic:{left:spoken.left,right:spoken.right,operator:spoken.operator,language:spoken.language}}:{})}}
 if(missingChromeQuery(text))return question('query',now)
 if(/^(?:(?:ช่วย|กรุณา|please)\s*)?(?:เปลี่ยนคำค้น|ค้นใหม่|ค้นต่อ|change(?: the)? search|search instead)/iu.test(text)){const query=explicitChromeQuery(text);if(query&&!/(?:แล้ว|และ)\s*(?:เปิด|ปิด|ลบ|ส่ง|ซื้อ|โอน)/u.test(text))return{kind:'research',instruction:'ค้นหา '+query};return{kind:'unsupported',message:'กรุณาระบุคำค้นเดียวที่ไม่มีลิงก์หรือคำสั่งอื่นครับ'}}
 const literalFollowup=pending&&pending.expiresAt>now&&['query','notepad-text'].includes(pending.slot)
 const knowledge=literalFollowup?null:assistantKnowledgeReply(text);if(knowledge)return{kind:'answer',message:knowledge}
 if(command.kind!=='unknown')return{kind:'app',instruction:text}
 const direct=typedCommand(work);if(direct.kind!=='unknown')return{kind:'app',instruction:direct.instruction}
 // Closed preparation requests name both the app and its ordinary purpose.
 // Canonicalize the plan only; the caller retains raw text and existing consent.
 const preparedApps=[['Chrome','(?:chrome|โครม|โครเมียม)','(?:เปิดเว็บ|เปิดเว็บไซต์|ท่องเว็บ)','(?:browsing|browsing the web|opening websites)'],['Notepad','(?:notepad|โน้ตแพด|สมุดบันทึก)','(?:จดบันทึก|เขียนข้อความ)','(?:taking notes|writing notes)'],['YouTube','(?:youtube|ยูทูบ)','(?:ดูวิดีโอ|ดูคลิป)','(?:watching videos)']] as const
 for(const [app,name,purpose,englishPurpose]of preparedApps){
  if(new RegExp('^เตรียม\\s*'+name+'\\s*(?:เพื่อ|สำหรับ|ไว้)\\s*'+purpose+'\\s*(?:ให้หน่อย|หน่อย)?\\s*(?:ครับ|ค่ะ)?$','iu').test(work)||new RegExp('^prepare\\s+'+name+'\\s+for\\s+'+englishPurpose+'\\s*(?:please)?$','iu').test(work))return{kind:'app',instruction:'เปิด '+app}
 }
 if(/^(?:ช่วย(?:ฉัน|ผม)?(?:หน่อย|งานนี้หน่อย|คิดให้หน่อย)|ทำให้หน่อย)(?:ครับ|ค่ะ)?$/u.test(text))return question('task',now)
 if(/^(?:(?:ช่วย|กรุณา)\s*)?(?:วางแผน|เตรียมแผน|จัดแผน)(?:\s*(?:ให้(?:ผม|ฉัน)?หน่อย|ให้หน่อย|หน่อย|ให้|ครับ|ค่ะ))*$/u.test(text))return{kind:'clarify',pending:{slot:'task',question:'ต้องการวางแผนเรื่องอะไรครับ?',expiresAt:now+60000}}
 if(/(?:แล้ว|และ)\s*(?:เปิด|ปิด|ลบ|ส่ง|ซื้อ|โอน|คำนวณ|ทำสไลด์)/u.test(text))return{kind:'unsupported',message:'กรุณาระบุงานทีละอย่างครับ เพื่อให้เลือกเครื่องมือและตรวจผลได้ตรงงาน'}
 if(/^(?:(?:ช่วย|กรุณา)\s*)?(?:คำนวณ|คิดเลข|ช่วยคิดเลข|\/calc)(?:\s*(?:ให้หน่อย|หน่อย|ครับ|ค่ะ))*$/iu.test(text))return question('expression',now)
 if(/^(?:(?:ช่วย|กรุณา)\s*)?(?:เปิด|เปิดโปรแกรม|open)(?:\s*(?:ให้หน่อย|หน่อย|ครับ|ค่ะ))*$/iu.test(text))return question('app',now)
 if(/^(?:(?:ช่วย|กรุณา)\s*)?(?:ค้นหา|หา|ค้นเว็บ|search)(?:\s*(?:ให้หน่อย|หน่อย|ครับ|ค่ะ))*$/iu.test(text))return question('query',now)
 if(!hasContext&&!pending&&/^(?:ช่วย)?(?:ทำ|จัด|เตรียม)?(?:อันนั้น|อันนี้|แบบนั้น|แบบเดิม)(?:ให้(?:หน่อย)?|หน่อย|ครับ|ค่ะ|นะ)*$/u.test(work))return question('task',now)
 if(pending&&pending.expiresAt>now){


  if(pending.slot==='expression'&&/^[\d\s.+\-*/()]+$/u.test(text)){const plan=textUtilityPlan('/calc '+text);if(plan)return{kind:'utility',plan}}
  if(pending.slot==='app'){const app=classifyVoiceCommand('เปิด '+text);if(['chrome','youtube','notepad'].includes(app.kind))return{kind:'app',instruction:app.instruction}}

 }
 const page=/^(?:ช่วย\s*)?(ทำ|สร้าง|เตรียม)สไลด์(?:\s+.+)?$/u.test(work)?'slides':/^(?:ช่วย\s*)?(?:อ่านภาพ|อ่านรูป|อ่านข้อความ(?:จากภาพ|ในรูป|ในภาพ)|ocr)(?:นี้|ให้หน่อย|\s+.+)?$/iu.test(work)?'ocr':/^(?:ช่วย\s*)?(?:ดูหน้าจอ|อ่านหน้าจอ|อ่านข้อความบน(?:หน้า)?จอ)(?:นี้|ให้หน่อย|\s+.+)?$/u.test(work)?'screen':null
 if(page)return{kind:'utility',plan:{kind:page,instruction:text}}
 if(/^(?:คำนวณ|คิดเลข|\/calc|\/time)/iu.test(text)||/[;&|\x60<>]|https?:|www\.|[\\/]/iu.test(text))return{kind:'unsupported',message:'ยังเลือกเครื่องมือให้คำขอนี้ไม่ได้ กรุณาระบุงานเดียว หรือสมการที่มีเฉพาะตัวเลขครับ'}
 if(/^(?:ช่วย\s*)?(?:เปิด|ปิด|ลบ|ส่ง|ซื้อ|โอน|ติดตั้ง|open|close|delete|send|buy|transfer)/iu.test(text))return{kind:'unsupported',message:'ตอนนี้ฉันเปิด Chrome, YouTube และ Notepad ได้ ต้องการใช้โปรแกรมใดครับ?'}
 return{kind:'research',instruction:text}
}
