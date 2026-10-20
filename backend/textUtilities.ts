import { requestIntent } from './requestIntent.js'
import type { TextMessage } from '../shared/chatProtocol.js'
import { CAPABILITY_NOTICE, UTILITY_HELP, type ReplySource } from '../shared/capabilities.js'

type Result = { source: ReplySource; text: string }
import {calculate} from '../shared/calculate.js'
export {calculate} from '../shared/calculate.js'
export function addMinutes(expression: string): string {
  if (expression.length > 128) throw new Error('คำสั่งยาวเกินไป')
  const match = /^(\d{2}):(\d{2})((?:\s*[+-]\s*\d{1,5})+)\s*$/.exec(expression)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('ใช้ HH:MM + นาที เช่น /time 14:00 + 45 + 20')
  const offsets = match[3].match(/[+-]\s*\d+/g)!
  if (offsets.length > 16) throw new Error('ระยะเวลามากเกินไป')
  const total = Number(match[1]) * 60 + Number(match[2]) + offsets.reduce((sum, item) => sum + Number(item.replace(/\s/g, '')), 0)
  const days = Math.floor(total / 1440), minutes = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${days ? ` (${days > 0 ? '+' : ''}${days} วัน)` : ''}`
}
export function resolveTextUtility(text: string, messages: readonly TextMessage[] = []): Result | null {
  const input = text.trim()
  if (/^\/capabilities$/i.test(input)) return { source: 'capabilities', text: CAPABILITY_NOTICE + '\n' + UTILITY_HELP }
  const match = /^\/(calc|time)(?:\s+(.*))?$/is.exec(input)
  if (!match) {
    const intent = requestIntent(input, messages)
    if (intent.kind === 'allow') return null
    const thai = /[\u0e00-\u0e7f]/u.test(input)
    return { source: 'capabilities', text: intent.kind === 'clarify'
      ? (thai ? 'ต้องการให้ช่วยเขียนข้อความหรืออธิบายวิธีทำเองใช่ไหม? ระบบทำงานภายนอกหรือแจ้งเตือนภายหลังให้ไม่ได้' : 'Do you want help drafting text or instructions? CIC cannot perform external actions or notify you later.')
      : (thai ? 'ระบบไม่ได้ทำงานภายนอก: ตั้งเตือน ส่งข้อความภายหลัง ดูหน้าจอ หรือกดปุ่มให้ไม่ได้ คุณทำในแอปของคุณเองได้' : 'No external action was performed. CIC cannot set reminders, message later, view your screen or click buttons. You can do that in your own app.') }
  }
  const source = match[1].toLowerCase() === 'calc' ? 'calculator' : 'time-calculator'
  try {
    const expression = (match[2] ?? '').trim()
    const answer = source === 'calculator' ? calculate(expression) : addMinutes(expression)
    return { source, text: `${expression} = ${answer}${source === 'time-calculator' ? '\nคำนวณเวลาเท่านั้น ไม่ได้ตั้งเตือนหรือนัดหมาย' : ''}` }
  } catch (error) { return { source, text: 'คำนวณไม่ได้: ' + (error instanceof Error ? error.message : 'รูปแบบไม่ถูกต้อง') } }
}
