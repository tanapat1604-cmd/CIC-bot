import type { ActionCommand, ActionProposal, AgentRequest } from './types'

// Validate structured proposals at the adapter boundary. Text deltas never become commands.
export function isAllowedProposal(value: unknown, request: AgentRequest): value is ActionProposal {
  if (!value || typeof value !== 'object' || request.mode !== 'assist') return false
  const action = value as Partial<ActionProposal>
  if (action.sessionId !== request.sessionId || action.operationId !== request.operationId || action.sourceId !== (request.source?.id ?? null)) return false
  const command = action.command
  if (!command || typeof command !== 'object') return false
  if (command.kind === 'click-save') return !!request.source && command.button === 'บันทึก'
  if (command.kind === 'type-text') return !!request.source && typeof command.text === 'string' && command.text.trim().length > 0 && command.text.length <= 500
  return command.kind === 'task-list'
}

export function describeCommand(command: ActionCommand) {
  switch (command.kind) {
    case 'click-save': return { title: 'จำลองคลิกปุ่มบันทึก', details: 'ชื่อปุ่ม: บันทึก', effect: 'แสดงผลจำลองว่าคลิกปุ่มบันทึก โดยไม่คลิกหรือบันทึกไฟล์จริง' }
    case 'type-text': return { title: 'จำลองพิมพ์ข้อความ', details: command.text, effect: 'แสดงผลจำลองว่าพิมพ์ข้อความตามรายละเอียด โดยไม่ส่งคีย์หรือแก้ไขหน้าต่างจริง' }
    case 'task-list': return { title: 'จัดทำรายการงานตัวอย่าง 3 ขั้นตอน', details: 'กำหนดเป้าหมาย → แบ่งงาน → ตรวจทาน', effect: 'แสดงรายการตัวอย่างในแชต โดยไม่แก้ไขไฟล์หรือเครื่องจริง' }
  }
}
