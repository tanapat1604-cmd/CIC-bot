import { useEffect, useRef, useState } from 'react'
import { backendUrl } from './store'
import { connectBackend, type BackendCapability } from './transport'
import type { SessionStore } from './types'
import s from './Workspace.module.css'

export default function ConnectionSettings({ store, onClose }: { store: SessionStore; onClose: () => void }) {
  const [checking, setChecking] = useState(false), [capability, setCapability] = useState<BackendCapability | null>(null), [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function check() {
    if (!backendUrl) return
    controller.current?.abort(); const pending = new AbortController(); controller.current = pending
    setChecking(true); setError(''); setCapability(null)
    try {
      const result = await connectBackend(backendUrl, AbortSignal.any([pending.signal, AbortSignal.timeout(5000)]))
      if (!pending.signal.aborted) setCapability(result)
    } catch (error) { if (!pending.signal.aborted) setError(error instanceof Error ? error.message : 'เชื่อมต่อไม่ได้') }
    finally { if (!pending.signal.aborted) setChecking(false) }
  }
  const start = (kind: 'demo' | 'test' | 'live') => { store.newSession(kind, capability?.model); onClose() }
  return <div className={s.connectionSettings}>
    <p className={s.modalIntro}>เปลี่ยนการเชื่อมต่อโดยเริ่มแชตใหม่ ประวัติเดิมจะอยู่ในแชตเดิมและไม่ส่งข้ามกัน</p>
    <button className={s.secondary} onClick={() => start('demo')}>เริ่มแชตตัวอย่างแอป</button>
    <div className={s.settingsRow}><b>AI ในเครื่อง</b><span>{capability?.kind === 'live' ? `Ollama · ${capability.model} · ข้อความเท่านั้น` : 'ตรวจ backend เพื่อเชื่อมโมเดลในเครื่อง'}</span></div>
    {backendUrl ? <>
      <button className={s.secondary} disabled={checking} onClick={() => void check()}>{checking ? 'กำลังตรวจการเชื่อมต่อ…' : 'ตรวจการเชื่อมต่อ backend'}</button>
      {capability && <><p role="status">{capability.kind === 'test' ? 'เชื่อมต่อ backend ทดสอบในเครื่องสำเร็จ · ไม่ใช่ AI จริง' : `พบโมเดลในเครื่อง ${capability.model}`}</p><button className={s.primary} onClick={() => start(capability.kind)}>{capability.kind === 'test' ? 'เริ่มแชตทดสอบ backend' : 'เริ่มแชต AI ในเครื่อง'}</button></>}
    </> : <p className={s.modalIntro}>เว็บสาธารณะยังใช้ตัวอย่างแอป การเชื่อม backend รอบนี้เปิดเฉพาะเครื่องพัฒนา</p>}
    {error && <p className={s.error} role="alert">{error}</p>}
    <p className={s.modalIntro}>backend รับข้อความเท่านั้น ยังไม่รับภาพหรือบริบทหน้าจอ และไม่เปิดอ่าน URL ไม่มีการสลับเป็นคำตอบจำลองเมื่อเชื่อมต่อขัดข้อง</p>
  </div>
}
