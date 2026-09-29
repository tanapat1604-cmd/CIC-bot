import { describeCommand } from './actions'
import type { ActionCommand, AgentAdapter, AgentRequest, ControlAdapter, ScreenSourceAdapter, SourceKind } from './types'

export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    const cancel = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, ms)
    signal.addEventListener('abort', cancel, { once: true })
  })
}
export const sourceNames: Record<SourceKind, string> = {
  desktop: 'หน้าจอตัวอย่าง — โต๊ะทำงาน', window: 'หน้าต่างตัวอย่าง — VS Code', tab: 'แท็บตัวอย่าง — แผนงาน',
}
const supported = 'ตัวอย่างนี้รองรับ: วิเคราะห์โค้ด วางแผนงาน คิดโปสเตอร์ และวิเคราะห์หน้าจอจำลอง ในโหมดช่วยทำลอง “คลิกปุ่มบันทึก”, “พิมพ์ข้อความ "สวัสดี"” หรือ “ช่วยทำรายการงาน” ได้'

function mockScenario(request: AgentRequest): { text: string; command?: ActionCommand } {
  const message = request.messages.filter(m => m.role === 'user').at(-1)!
  const text = message.text.trim()
  let command: ActionCommand | undefined
  // Explicit demo phrases only, never a parser for commands in AI-generated text.
  if (/^(?:ช่วย|ลอง|จำลอง)?\s*คลิก(?:ปุ่ม)?\s*บันทึก(?:\s*(?:ในหน้าต่างนี้|ในแท็บนี้|บนหน้าจอนี้))?$/u.test(text)) command = { kind: 'click-save', button: 'บันทึก' }
  const typing = /^(?:ช่วย|ลอง|จำลอง)?\s*พิมพ์(?:ข้อความ)?\s*["“]([^"”]{1,500})["”](?:\s*(?:ในหน้าต่างนี้|ในแท็บนี้|บนหน้าจอนี้))?$/u.exec(text)
  if (typing?.[1].trim()) command = { kind: 'type-text', text: typing[1] }
  if (/^(?:ช่วยทำ|จัดทำ|สร้าง)\s*รายการ(?:งาน|ใหม่|อีกครั้ง|สุดท้าย)?$/u.test(text)) command = { kind: 'task-list' }
  const note = message.attachments.length ? '\nสิ่งแนบอยู่ในแชตนี้เท่านั้น ตัวอย่างนี้ไม่ได้อ่านหรือวิเคราะห์เนื้อหาเหล่านั้น' : ''
  if (command) {
    if (request.mode !== 'assist') return { text: 'คำสั่งนี้เป็นตัวอย่างการลงมือทำ เลือกโหมดช่วยทำแล้วส่งอีกครั้งเพื่อดูรายละเอียดก่อนอนุญาต' + note }
    if (command.kind !== 'task-list' && !request.source) return { text: 'ลองเลือกหน้าจอจำลองก่อน เพื่อระบุเป้าหมายของคำสั่งนี้ แล้วส่งคำสั่งอีกครั้ง ระหว่างนี้ยังคุยทั่วไปได้' + note }
    return { text: 'ตรวจการกระทำ เป้าหมาย และรายละเอียดด้านล่างก่อนอนุญาตการจำลองนี้' + note, command }
  }
  let reply: string
  if (/(?:คลิก|พิมพ์|ลบไฟล์|ลงมือ|บันทึก)|^(?:ช่วยทำ|สร้าง|จัดทำ)/u.test(text) && !/^(?:ช่วย)?\s*(?:วิเคราะห์|วางแผน|แนะนำ|ตรวจ)/u.test(text)) reply = 'ยังไม่รู้จักคำสั่งนี้ใน preview จึงไม่ได้เสนอการกระทำ\n' + supported
  else if (/โค้ด|code/i.test(text)) reply = 'แนวทางตรวจโค้ดตัวอย่าง: ตรวจ input และผลลัพธ์ที่คาดไว้ แยกปัญหาให้เล็ก แล้วทดสอบกรณีขอบเขต\n```ts\nfunction greeting(name: string) {\n  return `Hello, ${name}`\n}\n```'
  else if (/โปสเตอร์|ออกแบบ/u.test(text)) reply = 'แนวทางโปสเตอร์ตัวอย่าง: เลือกข้อความหลักหนึ่งประโยค จัดลำดับหัวเรื่อง ภาพ และรายละเอียด ใช้สีหลัก 2–3 สี และตรวจว่าตัวอักษรอ่านได้ชัด'
  else if (/แผน|งาน/u.test(text)) reply = 'แผนงานตัวอย่าง\n1. กำหนดผลลัพธ์ที่ต้องการ\n2. แบ่งเป็นงานย่อยและจัดลำดับ\n3. ทดลองขั้นแรก แล้วตรวจทานก่อนเดินต่อ'
  else if (/หน้าจอ|วิเคราะห์/u.test(text)) reply = 'แนวทางวิเคราะห์ตัวอย่าง: ระบุเป้าหมาย มองหาข้อมูลที่เกี่ยวข้อง แล้วสรุปสิ่งที่ควรทำต่อ ภาพหน้าจอเป็นภาพจำลอง ยังไม่มีการอ่านหน้าจอจริง'
  else reply = 'ยังไม่มีสถานการณ์ตัวอย่างสำหรับข้อความนี้\n' + supported
  return { text: reply + (request.source ? `\nบริบทที่เลือก: ${request.source.name} (ภาพจำลอง)` : '') + note }
}

// Failure/timing injection is for tests only, with no user-facing debug controls.
export function createMockAdapters(options: { responseMs?: number; chunkMs?: number; executeMs?: number; failResponses?: number; failSources?: number; failExecutions?: number; failAfterChunks?: number } = {}) {
  let failures = options.failResponses ?? 0, sourceFailures = options.failSources ?? 0, executionFailures = options.failExecutions ?? 0
  let streamFailure = options.failAfterChunks
  const screen: ScreenSourceAdapter = {
    async select(kind, signal) {
      await abortableDelay(120, signal)
      if (sourceFailures-- > 0) throw new Error('ไม่สามารถเลือกแหล่งจำลองได้ ลองเลือกอีกครั้ง')
      return { id: crypto.randomUUID(), kind, name: sourceNames[kind] }
    },
  }
  const agent: AgentAdapter = {
    async *respond(request, signal) {
      const identity = { sessionId: request.sessionId, operationId: request.operationId }
      try {
        await abortableDelay(options.responseMs ?? 80, signal)
        if (failures-- > 0) { yield { ...identity, type: 'error', message: 'คำตอบจำลองขัดข้อง ลองอีกครั้งได้' }; return }
        const reply = mockScenario(request)
        // Four short chunks, ~320 ms total; no long pretend typing delay.
        const characters = Array.from(reply.text), size = Math.ceil(characters.length / 4)
        for (let index = 0, chunk = 0; index < characters.length; index += size, chunk++) {
          if (streamFailure === chunk) { streamFailure = undefined; yield { ...identity, type: 'error', message: 'การตอบจำลองขาดช่วง ลองอีกครั้งได้' }; return }
          await abortableDelay(options.chunkMs ?? 60, signal)
          yield { ...identity, type: 'delta', text: characters.slice(index, index + size).join('') }
        }
        if (reply.command) yield { ...identity, type: 'action', proposal: { ...identity, sourceId: request.source?.id ?? null, command: reply.command } }
        yield { ...identity, type: 'done' }
      } catch (error) {
        if (signal.aborted) { yield { ...identity, type: 'cancelled' }; return }
        throw error
      }
    },
  }
  const control: ControlAdapter = {
    async execute(action, signal) {
      await abortableDelay(options.executeMs ?? 650, signal)
      if (executionFailures-- > 0) throw new Error('การทำงานจำลองขัดข้อง โปรดลองส่งคำขอใหม่')
      const description = describeCommand(action.command)
      return `ผลจำลอง: ${description.title} เสร็จแล้ว\n${description.details}\nเป้าหมาย: ${action.target}\nไม่มีการเปลี่ยนแปลงบนเครื่องจริง`
    },
  }
  return { screen, agent, control }
}
