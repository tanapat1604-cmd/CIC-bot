import type { Session } from './types'
export function contextStatus(session: Session) {
  if (session.mode === 'chat') return session.source ? 'พักบริบท · โหมดคุย' : 'ไม่ใช้บริบทหน้าจอ'
  if (session.screen === 'selecting') return 'กำลังเลือกแหล่งจำลอง'
  if (session.screen === 'error') return 'เลือกแหล่งไม่สำเร็จ'
  return session.source ? 'เปิดใช้บริบทจำลอง' : 'ยังไม่เลือกบริบท'
}
