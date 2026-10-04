import { CAPABILITY_NOTICE, CIC_CAPABILITIES, UTILITY_HELP } from '../shared/capabilities.js'

// Bounded help only: these instructions never execute an action or replace general prose tasks.
const reminderHelp = 'คำแนะนำจากระบบสำหรับตั้งเอง: เปิดแอปนาฬิกาบนมือถือ เลือกนาฬิกาปลุก เพิ่มรายการ เลือกเวลาและวันที่ซ้ำตามต้องการ แล้วบันทึก ตรวจว่ารายการเปิดอยู่ เมนูอาจต่างกันตามอุปกรณ์ สำหรับเตือนประชุมหรือวันที่เฉพาะให้ใช้แอปปฏิทินของคุณและตรวจการอนุญาตแจ้งเตือน\nCIC ไม่ได้ตั้งเตือนให้ และตรวจมือถือหรือการแจ้งเตือนของคุณไม่ได้'
export const CALC_HELP = '/calc นิพจน์ เช่น /calc (100 - 45) / 2\nรองรับเลขอารบิก + - * / วงเล็บ เครื่องหมายบวก/ลบหน้าเลข และเศษส่วนที่แสดงแบบตรงค่า ไม่รองรับเลขยกกำลังหรือข้อความ\nขอบเขต: 128 ตัวอักษร, 48 token, ตัวเลขแต่ละตัวไม่เกิน 14 ตัวอักษรและทศนิยม 4 ตำแหน่ง; ตัวเศษ/ตัวส่วนหลังลดรูปไม่เกิน 10^18 หารด้วยศูนย์ไม่ได้'
export const TIME_HELP = '/time HH:MM + นาที หรือ - นาที เช่น /time 23:40 + 35\nใช้เวลา 00:00–23:59 และนาทีจำนวนเต็ม 0–99999 ต่อช่วง ไม่เกิน 16 ช่วงและ 128 ตัวอักษร ผลบอกจำนวนวันที่ข้ามด้วย\nคำนวณเวลาบนนาฬิกาเท่านั้น ไม่อ่านเวลาปัจจุบัน ไม่รองรับวันที่ เขตเวลา หรือการเปลี่ยนเวลาออมแสง และไม่ได้ตั้งเตือนหรือนัดหมาย'
export function systemHelp(original: string, visible: string): string | null {
  const text = visible.trim()
  if (/^\/help(?:\s+(?:calc|time))?$/i.test(text)) return /\s+calc$/i.test(text) ? CALC_HELP : /\s+time$/i.test(text) ? TIME_HELP : CAPABILITY_NOTICE + '\n' + UTILITY_HELP + '\n' + CALC_HELP + '\n' + TIME_HELP + '\nคำถามทั่วไปส่งให้โมเดลซึ่งอาจตอบผิดได้ ความสามารถภายนอกที่ปิดอยู่: ' + ([[CIC_CAPABILITIES.reminders, 'ตั้งเตือน'], [CIC_CAPABILITIES.futureWork, 'ทำงานภายหลัง'], [CIC_CAPABILITIES.screenRead, 'ดูหน้าจอ'], [CIC_CAPABILITIES.computerControl, 'ควบคุมเครื่อง'], [CIC_CAPABILITIES.fileAccess, 'อ่านไฟล์'], [CIC_CAPABILITIES.webAccess, 'เปิดเว็บ']] as const).filter(([enabled]) => !enabled).map(([, label]) => label).join(', ')
  // Anchor the instruction verb to its topic; "สอนทำอาหาร ไม่ต้องตั้งเตือน" is not reminder help.
  const instruction = /^(?:ช่วย\s*|กรุณา\s*|ขอ\s*)?(?:สอน(?:วิธี)?|อธิบายวิธี|บอกวิธี|ขอวิธี|แนะนำวิธี|วิธี)\s*/i
  const topic = text.replace(instruction, '')
  if (topic === text) return null
  if (/^(?:ตั้ง(?:การ)?เตือน|ตั้งนาฬิกาปลุก|ตั้งปลุก)/u.test(topic)) {
    // A second enactment in the same clause is ambiguous; never report it done or silently ignore it.
    const afterTopic = topic.replace(/^(?:ตั้ง(?:การ)?เตือน|ตั้งนาฬิกาปลุก|ตั้งปลุก)/u, '')
    if (/(?:ตั้ง|ทำ).*(?:ให้ฉัน|ให้ผม|ให้ด้วย|จริง)/u.test(afterTopic)) return null
    return reminderHelp
  }
  if (/^ใช้\s+\/(?:calc|time)\b/i.test(topic) && !/(?:แปล|ร่าง|เขียน|ส่งให้|ตั้งเตือนให้|กดให้)/u.test(topic)) {
    return (/\/calc\b/i.test(original) ? CALC_HELP : '') + (/\/calc\b/i.test(original) && /\/time\b/i.test(original) ? '\n' : '') + (/\/time\b/i.test(original) ? TIME_HELP : '')
  }
  return null
}
