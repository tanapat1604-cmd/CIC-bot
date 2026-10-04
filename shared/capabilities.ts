// CIC's implemented capabilities; model text can never grant or complete an external action.
export const CIC_CAPABILITIES = Object.freeze({ version: 1, textChat: true, calculator: true, timeArithmetic: true, reminders: false, futureWork: false, screenRead: false, computerControl: false, fileAccess: false, webAccess: false })
export type ReplySource = 'model' | 'calculator' | 'time-calculator' | 'capabilities' | 'mixed' | 'help'
export const REPLY_SOURCES: readonly ReplySource[] = ['model', 'calculator', 'time-calculator', 'capabilities', 'mixed', 'help']
export const CAPABILITY_NOTICE = 'ส่งข้อความเท่านั้น · ไม่ได้ตั้งเตือน ดูหน้าจอ กดปุ่ม หรือทำงานภายหลัง'
export const UTILITY_HELP = 'คำนวณในเครื่อง: /calc 100 - 45 - 15 หรือ /time 14:00 + 45 + 20 (นาที) · /capabilities ดูความสามารถ · /help ดูวิธีใช้และขอบเขต'
