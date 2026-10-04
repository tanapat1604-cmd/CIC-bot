import { requestIntent } from './requestIntent.js'
import type { TextMessage } from '../shared/chatProtocol.js'
import { CAPABILITY_NOTICE, UTILITY_HELP, type ReplySource } from '../shared/capabilities.js'

type Result = { source: ReplySource; text: string }
type Fraction = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a < 0n ? -a : a
function fraction(n: bigint, d = 1n): Fraction {
  if (!d) throw new Error('หารด้วยศูนย์ไม่ได้')
  if (d < 0n) { n = -n; d = -d }
  const g = gcd(n, d), value = { n: n / g, d: d / g }
  if (value.n > 10n ** 18n || value.n < -(10n ** 18n) || value.d > 10n ** 18n) throw new Error('ตัวเลขเกินขอบเขต')
  return value
}
function format(value: Fraction) {
  let d = value.d
  for (const factor of [2n, 5n]) while (d % factor === 0n) d /= factor
  if (d !== 1n) return `${value.n}/${value.d}` // Exact rational, never a misleading rounded decimal.
  const sign = value.n < 0n ? '-' : '', n = value.n < 0n ? -value.n : value.n
  let rest = n % value.d, decimal = ''
  while (rest) { rest *= 10n; decimal += String(rest / value.d); rest %= value.d }
  return `${sign}${n / value.d}${decimal ? '.' + decimal : ''}`
}
export function calculate(expression: string): string {
  if (!expression.trim() || expression.length > 128 || /[^\d\s.+\-*/()]/u.test(expression)) throw new Error('รองรับตัวเลข + - * / และวงเล็บ ไม่เกิน 128 ตัวอักษร')
  const tokens = expression.match(/\d+(?:\.\d{1,4})?|[()+\-*/]/g) ?? []
  if (tokens.join('') !== expression.replace(/\s/g, '') || tokens.length > 48) throw new Error('รูปแบบนิพจน์ไม่ถูกต้องหรือยาวเกินไป')
  let at = 0
  const atom = (): Fraction => {
    const token = tokens[at++]
    if (token === '+' || token === '-') { const value = atom(); return token === '-' ? { ...value, n: -value.n } : value }
    if (token === '(') { const value = sum(); if (tokens[at++] !== ')') throw new Error('วงเล็บไม่ครบ'); return value }
    if (!token || !/^\d+(?:\.\d+)?$/.test(token) || token.length > 14) throw new Error('คาดว่าจะเป็นตัวเลข')
    const [whole, decimals = ''] = token.split('.')
    return fraction(BigInt(whole + decimals), 10n ** BigInt(decimals.length))
  }
  const product = (): Fraction => {
    let value = atom()
    while (tokens[at] === '*' || tokens[at] === '/') {
      const op = tokens[at++], right = atom()
      value = op === '*' ? fraction(value.n * right.n, value.d * right.d) : fraction(value.n * right.d, value.d * right.n)
    }
    return value
  }
  const sum = (): Fraction => {
    let value = product()
    while (tokens[at] === '+' || tokens[at] === '-') {
      const op = tokens[at++], right = product()
      value = fraction(value.n * right.d + (op === '+' ? 1n : -1n) * right.n * value.d, value.d * right.d)
    }
    return value
  }
  const value = sum()
  if (at !== tokens.length) throw new Error('มีข้อความหรือเครื่องหมายเกิน')
  return format(value)
}
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
