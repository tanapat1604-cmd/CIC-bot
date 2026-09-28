import Icon from '../Icon'
import type { Session, SessionStore } from './types'
import s from './Workspace.module.css'
import { contextStatus } from './status'
export default function ContextPanel({ session, store, onSelect }: { session: Session; store: SessionStore; onSelect: () => void }) {
  return <div className={s.contextBody}>
    <div className={s.contextLabel}><span className={s.dot} data-active={session.mode !== 'chat' && !!session.source} />{contextStatus(session)}</div>
    {session.source ? <>
      <div className={s.screenPreview} aria-label={`ภาพจำลอง ${session.source.name}`}>
        <div className={s.previewBar}><i /><i /><i /><span>ภาพจำลอง</span></div>
        <div className={s.previewDocument}><small>{session.source.kind === 'window' ? 'hello.ts' : 'แผนงานของวันนี้'}</small>{session.source.kind === 'window' ? <pre><code>{'const goal = "เริ่มต้น"\n\nfunction nextStep() {\n  return "ค่อย ๆ ไปต่อ"\n}'}</code></pre> : <><b>ทำทีละอย่าง ให้ชัดขึ้น</b><p>✓ กำหนดเป้าหมาย</p><p>□ แบ่งงานเป็นขั้นตอน</p><p>□ ตรวจทานร่วมกัน</p></>}</div>
      </div>
      <h3>{session.source.name}</h3>
      <p className={s.subtle}>{session.mode === 'chat' ? 'เก็บแหล่งที่เลือกไว้ แต่ไม่ใช้ในโหมดคุย' : 'ใช้ภาพตัวอย่างที่เตรียมไว้สำหรับการจำลอง'}</p>
      <button className={s.secondary} onClick={onSelect}><Icon name="screen" size={17} />เปลี่ยนแหล่ง</button>
      <button className={s.textButton} onClick={() => store.disconnect()}>หยุดใช้บริบท</button>
    </> : <div className={s.contextEmpty}><span className={s.contextIcon}><Icon name="screen" size={28} /></span><h3>เลือกสิ่งที่จะให้ CIC ดู</h3><p>ลองบริบทจากหน้าจอ หน้าต่าง หรือแท็บตัวอย่าง</p><button className={s.secondary} onClick={onSelect}>ลองเลือกหน้าจอ</button></div>}
    <div className={s.permission}><Icon name="shield" size={18} /><div><b>สิทธิ์ในโหมดนี้</b><p>{session.mode === 'chat' ? 'สนทนาเท่านั้น ไม่ใช้ภาพหน้าจอ' : session.mode === 'observe' ? 'วิเคราะห์และแนะนำจากบริบทจำลอง ไม่มีการลงมือทำ' : 'เสนอการกระทำจำลอง รอคุณอนุญาตเป็นรายการ การเลือกโหมดไม่ได้ให้สิทธิ์ควบคุมเครื่อง'}</p></div></div>
  </div>
}
