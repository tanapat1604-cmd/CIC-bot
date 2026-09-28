import type { AgentAdapter, ControlAdapter, ScreenSourceAdapter, SourceKind } from './types'

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

// Injection is only for tests, never a production debug switch or hidden command.
export function createMockAdapters(options: { responseMs?: number; executeMs?: number; failResponses?: number; failSources?: number; failExecutions?: number } = {}) {
  let failures = options.failResponses ?? 0, sourceFailures = options.failSources ?? 0, executionFailures = options.failExecutions ?? 0
  const screen: ScreenSourceAdapter = {
    async select(kind, signal) {
      await abortableDelay(120, signal)
      if (sourceFailures-- > 0) throw new Error('ไม่สามารถเลือกแหล่งจำลองได้ ลองเลือกอีกครั้ง')
      return { id: `mock-${kind}`, kind, name: sourceNames[kind] }
    },
  }
  const agent: AgentAdapter = {
    async respond(request, signal) {
      await abortableDelay(options.responseMs ?? 280, signal)
      if (failures-- > 0) throw new Error('คำตอบจำลองขัดข้อง ลองอีกครั้งได้')
      const { text, source, mode, sessionId, operationId } = request
      const attachmentNote = request.attachmentCount ? '\nไฟล์และลิงก์ที่แนบอยู่ในแชตนี้เท่านั้น ตัวอย่างนี้ไม่ได้อ่านหรือวิเคราะห์เนื้อหาเหล่านั้น' : ''
      const contextNote = source && mode !== 'chat' ? `\nบริบทที่เลือก: ${source.name} (ภาพจำลอง)` : ''
      // Only explicit action requests in assist mode produce an approval.
      const wantsAction = /ช่วยทำ|สร้าง|จัดทำ|ลงมือ|แก้ไข|บันทึก|create|execute/i.test(text)
      if (mode === 'assist' && wantsAction) return {
        text: 'เตรียมตัวอย่างการจัดรายการงานให้แล้ว ตรวจเป้าหมายและอนุญาตทีละรายการได้ด้านล่าง' + attachmentNote,
        action: { sessionId, operationId, sourceId: source?.id ?? null, title: 'จัดทำรายการงานตัวอย่าง 3 ขั้นตอน', target: source?.name ?? 'พื้นที่ตัวอย่างในแชตนี้', effect: 'แสดงรายการ: กำหนดเป้าหมาย → แบ่งงาน → ตรวจทาน โดยไม่แก้ไขไฟล์หรือเครื่องจริง' },
      }
      let reply = 'เริ่มจากบอกเป้าหมาย ผลลัพธ์ที่ต้องการ และสิ่งที่ติดอยู่ แล้วแบ่งเป็นขั้นตอนเล็ก ๆ เพื่อเลือกทำทีละอย่าง'
      if (/โค้ด|code/i.test(text)) reply = 'แนวทางตรวจโค้ดตัวอย่าง: ตรวจ input และผลลัพธ์ที่คาดไว้ แยกปัญหาให้เล็ก แล้วทดสอบกรณีขอบเขต\n```ts\nfunction greeting(name: string) {\n  return `Hello, ${name}`\n}\n```'
      else if (/โปสเตอร์|ออกแบบ/i.test(text)) reply = 'แนวทางโปสเตอร์ตัวอย่าง: เลือกข้อความหลักหนึ่งประโยค จัดลำดับหัวเรื่อง ภาพ และรายละเอียด ใช้สีหลัก 2–3 สี และตรวจว่าตัวอักษรอ่านได้ชัด'
      else if (/แผน|งาน/i.test(text)) reply = 'แผนงานตัวอย่าง\n1. กำหนดผลลัพธ์ที่ต้องการ\n2. แบ่งเป็นงานย่อยและจัดลำดับ\n3. ทดลองขั้นแรก แล้วตรวจทานก่อนเดินต่อ'
      else if (/หน้าจอ|วิเคราะห์/i.test(text)) reply = 'แนวทางวิเคราะห์ตัวอย่าง: ระบุเป้าหมาย มองหาข้อมูลที่เกี่ยวข้อง แล้วสรุปสิ่งที่ควรทำต่อ ภาพหน้าจอในตัวอย่างเป็นภาพที่เตรียมไว้ ยังไม่มีการอ่านหน้าจอจริง'
      return { text: reply + contextNote + attachmentNote }
    },
  }
  const control: ControlAdapter = {
    async execute(_action, signal) {
      await abortableDelay(options.executeMs ?? 650, signal)
      if (executionFailures-- > 0) throw new Error('การทำงานจำลองขัดข้อง โปรดลองส่งคำขอใหม่')
      return 'ผลจำลอง: กำหนดเป้าหมาย → แบ่งงาน → ตรวจทาน เสร็จแล้ว ไม่มีการเปลี่ยนแปลงบนเครื่องจริง'
    },
  }
  return { screen, agent, control }
}
