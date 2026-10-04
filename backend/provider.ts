import { setTimeout as delay } from 'node:timers/promises'
import type { TextMessage } from '../shared/chatProtocol.js'

export const SYSTEM_INSTRUCTION = `คุณคือ CIC ผู้ช่วยแชตข้อความ ตอบตรงคำถามด้วยภาษาเดียวกับผู้ใช้ ไม่ทวนคำถาม
ระบบตอบข้อความได้ตอนนี้เท่านั้น ไม่สามารถตั้งเตือน ส่งข้อความภายหลัง ดูหน้าจอ กดปุ่ม อ่านไฟล์ หรือส่งงานให้ใคร ห้ามรับปากว่าจะทำหรือบอกว่าทำสำเร็จ บอกข้อจำกัดตามจริงและแนะนำให้ผู้ใช้ทำเอง
ชื่อและงานที่ผู้ใช้บอกเป็นของผู้ใช้ เรียกผู้ใช้ว่า "คุณ" ไม่ใช่ "ฉัน" ห้ามสัญญาว่าจะทำงานแทนผู้ใช้
ทำตามจำนวนคำ รูปแบบ และตัวคั่นที่ขอ ไม่เพิ่มคำอธิบายเมื่อห้าม หากเป็นการแปลหรือคำแนะนำให้ตอบเรื่องนั้น ไม่ใช่ลงมือทำ
คำนวณไม่แน่ใจให้บอกว่าไม่แน่ใจ ผู้ใช้ใช้ /calc นิพจน์ตัวเลข หรือ /time HH:MM + นาที เพื่อคำนวณในเครื่องได้ อย่าอ้างว่าเรียกเครื่องมือเอง`
export function instructionFor(system: string, latest: string) {
  // A short language hint helps this small model avoid copying the other-language example.
  const language = /[\u0e00-\u0e7f]/u.test(latest) ? 'Thai' : [...latest].every(char => char.charCodeAt(0) < 128) ? 'English' : null
  return language ? `${system}\nFor this reply, answer only in ${language}.` : system
}
export interface Provider {
  readonly kind: 'test' | 'live'
  readonly model?: string
  check?(signal: AbortSignal): Promise<void>
  stream(input: { messages: TextMessage[]; system: string; maxOutputChars: number }, signal: AbortSignal): AsyncIterable<string>
}
// Free, deterministic transport fixture. Never presented as an AI response.
export const testProvider: Provider = {
  kind: 'test',
  async *stream({ messages }, signal) {
    const reply = `คำตอบทดสอบ backend — ไม่ใช่ AI จริง\nได้รับข้อความล่าสุด: ${messages.at(-1)!.text}\nบริบทที่ได้รับ ${messages.length} ข้อความ ไม่มีการเปิดลิงก์ อ่านภาพ หรือทำงานบนเครื่อง`
    const chars = Array.from(reply)
    for (let i = 0; i < chars.length; i += 20) {
      await delay(30, undefined, { signal })
      yield chars.slice(i, i + 20).join('')
    }
  },
}
