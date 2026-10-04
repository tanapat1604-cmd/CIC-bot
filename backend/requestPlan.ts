import type { TextMessage } from '../shared/chatProtocol.js'
import { requestIntent } from './requestIntent.js'

export type RequestPlan = { kind: 'model' | 'system' | 'mixed' | 'clarify'; original: string; allowed: string[]; denied: string[]; resolvedFrom?: number }
const task = /ร่าง|เขียน|แปล|อธิบาย|บอกวิธี|แนะนำ|ยกตัวอย่าง|สรุป|คำนวณ|draft|write|translate|explain|calculate|how to/i
const external = /เตือน|ปลุก|ทัก|ส่งข้อความ|ส่งให้|ส่งเลย|กด|คลิก|หน้าจอ|จอที่|remind|notify|click|press|send/i
/** Mask quotes only for classification; every delivered/requested part retains the original text. */
export function maskQuotes(text: string) {
  let masked = '', close = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (close) { masked += ' '; if (char === close) close = ''; continue }
    if (char === '"' || char === '“' || char === '‘' || char === '«' || char === '`' || (char === "'" && !/[\p{L}\p{N}]/u.test(text[i - 1] ?? ''))) {
      close = ({ '“': '”', '‘': '’', '«': '»' } as Record<string, string>)[char] ?? char; masked += ' '
    } else masked += char
  }
  return { text: masked, unclosed: !!close }
}
export function clauses(text: string) {
  const masked = maskQuotes(text)
  const separators = /แล้ว|จากนั้น|และ|พร้อมทั้ง|พร้อมกับ|\n|[;。]|\s+(?:and|then|but)\s+/gi
  const parts: string[] = []; let start = 0
  for (const match of masked.text.matchAll(separators)) { const part = text.slice(start, match.index).trim(); if (part) parts.push(part); start = match.index + match[0].length }
  const last = text.slice(start).trim(); if (last) parts.push(last)
  return { parts, unclosed: masked.unclosed }
}
export function planRequest(messages: readonly TextMessage[]): RequestPlan {
  const original = messages.at(-1)!.text, visible = maskQuotes(original)
  const empty = (kind: RequestPlan['kind']): RequestPlan => ({ kind, original, allowed: [], denied: [] })
  if (visible.unclosed && external.test(original)) return empty('clarify')
  // Resolve only explicit references using submitted user turns; assistant promises never count.
  if (/^(?:ทำเลย|เอาเลย|ทำตามที่ขอไว้เลย|จัดการอันนั้นเลย|ตกลง|do it)[.!\s]*$/i.test(original.trim())) {
    for (let i = messages.length - 2; i >= 0; i--) {
      if (messages[i].role !== 'user') continue
      const prior = maskQuotes(messages[i].text).text
      if (!task.test(prior) && !external.test(prior) && !/ยกเลิก|แก้คำสั่ง|cancel/i.test(prior)) continue
      if (/ยกเลิก|cancel/i.test(prior) && !task.test(prior)) return empty('clarify')
      const resolved = planRequest(messages.slice(0, i + 1))
      if (resolved.kind === 'mixed' || resolved.kind === 'clarify') return empty('clarify')
      return { ...resolved, original, resolvedFrom: i }
    }
    return empty('clarify')
  }
  const split = clauses(original)
  if (split.parts.length > 4) return empty('clarify')
  const allowed: string[] = [], denied: string[] = []
  for (const part of split.parts) {
    const text = maskQuotes(part).text
    const negatedSend = /(?:ไม่ต้อง|อย่า|ห้าม).{0,10}ส่ง|(?:do not|don't).{0,10}send/i.test(text)
    const userSends = /(?:ฉัน|ผม|เรา|i).{0,8}(?:จะ)?ส่ง.{0,15}เอง|i will send/i.test(text)
    const send = !negatedSend && !userSends && /(?:ส่งให้|ส่งเลย|ส่งข้อความ|send).+/i.test(text)
    const falseCompletion = /(?:ตอบ|บอก|พูด|say|tell).*(?:สำเร็จ|เรียบร้อย|เสร็จ|done|completed)/i.test(text + (task.test(text) ? '' : original)) && !task.test(text)
    const explicitEnact = /(?:ทำให้จริง|ทำจริง|ทำแบบนั้น|บนเครื่องฉัน|กดให้|ส่งให้)/i.test(text) && !task.test(text) && !/(?:ไม่ต้อง|อย่า).{0,8}(?:ทำ|กด|ส่ง)/i.test(text)
    const intent = requestIntent(part, messages)
    if (falseCompletion || (send && !task.test(text)) || explicitEnact || intent.kind === 'refuse') denied.push(part)
    else if (/^\/(?:calc|time)\b/i.test(part) || task.test(text)) allowed.push(part)
    else if (intent.kind === 'clarify') return empty('clarify')
  }
  if (denied.length) return { kind: allowed.length ? 'mixed' : 'system', original, allowed, denied }
  return { kind: 'model', original, allowed: [original], denied: [] }
}
