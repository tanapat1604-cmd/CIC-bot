// CIC's implemented capabilities; model text can never grant or complete an external action.
export const CIC_CAPABILITIES = Object.freeze({ version: 1, textChat: true, calculator: true, timeArithmetic: true, reminders: false, futureWork: false, screenRead: false, computerControl: false, fileAccess: false, webAccess: false })
export const CAPABILITY_CATALOG = [
  { id: 'calculator', status: 'available', label: 'คำนวณเลขและเวลา', detail: '/calc และ /time — เครื่องมือในเครื่อง มีขอบเขตรูปแบบคำสั่ง' },
  { id: 'chat', status: 'experimental', label: 'สนทนาและร่างข้อความ', detail: 'โมเดลในเครื่อง — ภาษาไทยและเหตุผลยังอาจผิด ต้องตรวจคำตอบ' },
  { id: 'chess', status: 'available', label: 'หมากรุกในเครื่อง', detail: 'เปิดปุ่มหมากรุก — ต้องติดตั้ง Stockfish 19 และเปิด backend ในเครื่อง; เว็บสาธารณะเป็นตัวอย่างกระดาน' },
  { id: 'slides', status: 'experimental', label: 'สไลด์', detail: 'เปิดสไลด์ในเครื่อง — สร้างจากโครงเรื่องที่ผู้ใช้ตรวจ ต้องตั้งค่าเครื่องมือและ PowerPoint; เว็บสาธารณะเป็น demo' },
  { id: 'ocr', status: 'experimental', label: 'อ่านข้อความจากภาพ', detail: 'OCR ในเครื่อง — เลือกภาพ ภาษา และพื้นที่เอง ตรวจแก้ก่อนคัดลอกหรือนำเป็นข้อมูลอ้างอิงในแชต ไม่ใช่โมเดลรับภาพ; เว็บสาธารณะเป็น demo' },
  { id: 'video', status: 'unsupported', label: 'วิดีโอ', detail: 'ยังไม่มีการตัดต่อหรือสร้างไฟล์วิดีโอจากแอป' },
  { id: 'puzzles', status: 'unsupported', label: 'เกมและปริศนา', detail: 'ยังไม่มี solver ที่ตรวจคำตอบได้' },
] as const
export const CAPABILITY_STATUS = { available: 'ใช้ได้จริง', experimental: 'ทดลอง', unsupported: 'ยังไม่รองรับ' } as const
export type ReplySource = 'model' | 'calculator' | 'time-calculator' | 'capabilities' | 'mixed' | 'help'
export const REPLY_SOURCES: readonly ReplySource[] = ['model', 'calculator', 'time-calculator', 'capabilities', 'mixed', 'help']
export const CAPABILITY_NOTICE = 'ส่งข้อความเท่านั้น · ไม่ได้ตั้งเตือน ดูหน้าจอ กดปุ่ม หรือทำงานภายหลัง'
export const UTILITY_HELP = 'คำนวณในเครื่อง: /calc 100 - 45 - 15 หรือ /time 14:00 + 45 + 20 (นาที) · /capabilities ดูความสามารถ · /help ดูวิธีใช้และขอบเขต'
