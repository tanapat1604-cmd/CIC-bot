import { setTimeout as delay } from 'node:timers/promises'
import type { TextMessage } from '../shared/chatProtocol.js'

export const SYSTEM_INSTRUCTION = `You are CIC. You receive TEXT ONLY. You have NO screen access, NO file access, NO browser and NO computer-control tools. Never claim you can see a screen or completed an action. Answer directly in the user's language, in 1-3 short sentences. Do not repeat the question or show reasoning.
When asked to see a screen or click Save, the truthful English answer is: "I cannot see your screen or click buttons. You can click Save yourself."
คำตอบภาษาไทยเมื่อขอดูหน้าจอหรือกดบันทึก: "ฉันไม่เห็นหน้าจอและกดปุ่มให้ไม่ได้ คุณกดปุ่มบันทึกเองได้ค่ะ"
For other questions, help using only the text the user gives you.`
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
