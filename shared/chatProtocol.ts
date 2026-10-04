export const LIMITS = { messages: 24, messageChars: 8000, totalChars: 24000, bodyBytes: 160000, outputChars: 12000, lineChars: 64000 } as const
export type TextMessage = { role: 'user' | 'assistant'; text: string }
export type TextRequest = { sessionId: string; operationId: string; messages: TextMessage[] }
export const errors = {
  invalid: 'รูปแบบคำขอไม่ถูกต้อง รองรับเฉพาะแชตข้อความ',
  too_large: 'ข้อความยาวเกินกำหนด กรุณาย่อข้อความแล้วส่งใหม่',
  unauthorized: 'สิทธิ์เชื่อมต่อหมดอายุ เปิดการเชื่อมต่อแล้วตรวจอีกครั้ง',
  limited: 'ถึงขีดจำกัดการใช้งานชั่วคราว กรุณารอสักครู่',
  unavailable: 'เชื่อมต่อบริการไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง',
  interrupted: 'การเชื่อมต่อขาดช่วงก่อนตอบครบ ลองอีกครั้งได้',
  timeout: 'บริการใช้เวลานานเกินกำหนด ลองอีกครั้งได้',
  output_limit: 'คำตอบถึงขีดจำกัดแล้ว กรุณาถามให้แคบลง',
  model_missing: 'ไม่พบโมเดลที่ตั้งไว้ใน Ollama กรุณาตรวจชื่อโมเดลที่ติดตั้งแล้ว',
  model_settings: 'โมเดลนี้ไม่รองรับค่า thinking ที่ตั้งไว้ กรุณาตรวจการตั้งค่า backend',
} as const
export type ErrorCode = keyof typeof errors
export type TextEvent = { sessionId: string; operationId: string } & (
  { type: 'delta'; text: string } | { type: 'done' } | { type: 'cancelled' } | { type: 'error'; code: ErrorCode }
)
export class ChatError extends Error {
  constructor(public code: ErrorCode) { super(errors[code]) }
}
export function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function exact(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)) }
function identity(value: unknown): value is string { return typeof value === 'string' && /^[\w-]{1,80}$/.test(value) }
export function validateRequest(value: unknown): TextRequest {
  if (!record(value) || !exact(value, ['sessionId', 'operationId', 'messages']) || !identity(value.sessionId) || !identity(value.operationId) || !Array.isArray(value.messages) || !value.messages.length) throw new ChatError('invalid')
  if (value.messages.length > LIMITS.messages) throw new ChatError('too_large')
  let size = 0
  for (const message of value.messages) {
    if (!record(message) || !exact(message, ['role', 'text']) || (message.role !== 'user' && message.role !== 'assistant') || typeof message.text !== 'string' || !message.text.trim()) throw new ChatError('invalid')
    size += message.text.length
    if (message.text.length > LIMITS.messageChars || size > LIMITS.totalChars) throw new ChatError('too_large')
  }
  if (value.messages[0].role !== 'user' || value.messages.at(-1).role !== 'user') throw new ChatError('invalid')
  return value as TextRequest
}
export function validateEvent(value: unknown, request: Pick<TextRequest, 'sessionId' | 'operationId'>): TextEvent {
  if (!record(value) || value.sessionId !== request.sessionId || value.operationId !== request.operationId) throw new ChatError('interrupted')
  const keys = ['sessionId', 'operationId', 'type']
  if (value.type === 'delta' && typeof value.text === 'string' && value.text.length > 0 && value.text.length <= LIMITS.outputChars && exact(value, [...keys, 'text'])) return value as TextEvent
  if ((value.type === 'done' || value.type === 'cancelled') && exact(value, keys)) return value as TextEvent
  if (value.type === 'error' && typeof value.code === 'string' && Object.hasOwn(errors, value.code) && exact(value, [...keys, 'code'])) return value as TextEvent
  throw new ChatError('interrupted')
}
