import type {AssistantInput,AssistantDecision} from '../shared/assistant.js'
import {assistantFollowup} from './assistantMemory.js'
// Eligible proposals never grant execution authority. Do not let a time budget
// or stale history make ordinary advice eligible for a numeric/time operation.
export function assistantToolsFor(input:AssistantInput):AssistantDecision['tool'][] {
 const tools:AssistantDecision['tool'][]=['answer','ask']
 const latest=input.text.normalize('NFC').trim()
 if(/^(?:อย่า|ไม่ต้อง|ห้าม|ยกเลิก|do not\b|don't\b|cancel\b)/iu.test(latest))return tools
 const followup=assistantFollowup(input)
 const context=[latest,input.question??'',...(followup?input.history.map(m=>m.text):[])].join(' ')
 const how=/(?:ยังไง|อย่างไร|อธิบาย|คืออะไร|หมายความ|\bhow\b|\bwhat\b.+\b(?:mean|means|is|are)\b)/iu.test(latest)
 const numeric=/\d/u.test(context)
 const arithmetic=/(?:คำนวณ|คิดเลข|บวก|ลบ|คูณ|หาร|แจก|เอาออก|เหลือ|รวมทั้งหมด|รวมเป็นเงิน|\b(?:calculate|compute|sum|total|remaining|remain|left|cost|give|gave)\b|\bhow many\b)/iu.test(context)||/\d\s*[+*/-]\s*\d/u.test(context)
 if(numeric&&arithmetic)tools.push('calculator')
 const clock=/(?:กี่โมง|เวลาตอนนี้|ตอนนี้เวลา|\bwhat(?:'s| is)?\s+the\s+time\b|\bwhat time is it\b|\btime now\b)/iu.test(context)
 if(clock)tools.push('clock')
 if(/\b\d{1,2}:\d{2}\b/u.test(context)&&/(?:คำนวณ|อีก|หลัง|บวก|ลบ|\b(?:calculate|after|later|plus|minus)\b)/iu.test(context))tools.push('time-calculator')
 if(!how){
  if(/(?:อ่าน|ถอด|\b(?:read|extract)\b)/iu.test(context)&&/(?:รูป|ภาพ|\b(?:image|picture|ocr)\b)/iu.test(context))tools.push('ocr')
  if(/(?:แชร์|ดู|อ่าน|\b(?:share|view|read)\b)/iu.test(context)&&/(?:หน้าจอ|\bscreen\b)/iu.test(context))tools.push('screen')
  if(/(?:ทำ|สร้าง|เตรียม|\b(?:make|create|prepare)\b)/iu.test(context)&&/(?:สไลด์|\b(?:slides|presentation)\b)/iu.test(context))tools.push('slides')
  if(/(?:เปิด|\bopen\b)/iu.test(context)&&/(?:โน้ตแพด|สมุดบันทึก|โครม|ยูทูบ|\b(?:notepad|chrome|youtube)\b)/iu.test(context))tools.push('app')
 }
 if(/(?:ค้นหา|ค้นเว็บ|หาข้อมูล|\bsearch\b|\blook up\b|\bfind information\b)/iu.test(context))tools.push('research')
 return tools
}
