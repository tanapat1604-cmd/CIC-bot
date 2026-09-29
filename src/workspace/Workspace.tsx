import { useEffect, useState, useSyncExternalStore } from 'react'
import Brand from '../Brand'
import Icon from '../Icon'
import { useMediaQuery } from '../useMotion'
import Chat from './Chat'
import ContextPanel from './ContextPanel'
import { contextStatus } from './status'
import Modal from './Modal'
import { sessionStore as store } from './store'
import type { Mode, SourceKind } from './types'
import s from './Workspace.module.css'

const modes: { id: Mode; label: string; description: string }[] = [
  { id: 'chat', label: 'คุย', description: 'สนทนาโดยไม่ใช้ภาพหน้าจอ' },
  { id: 'observe', label: 'ให้ดู', description: 'วิเคราะห์และแนะนำจากบริบทจำลอง' },
  { id: 'assist', label: 'ช่วยทำ', description: 'เสนอการกระทำ รออนุญาตทีละรายการ' },
]
const status = { idle: 'พร้อมคุย', responding: 'กำลังตอบ', 'awaiting-approval': 'รอคุณอนุญาต', executing: 'กำลังทำการจำลอง', paused: 'หยุดแล้ว', error: 'มีข้อผิดพลาด' }
export default function Workspace() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const session = state.sessions.find(item => item.id === state.sessionId)!
  const compact = state.layout === 'compact'
  const narrow = useMediaQuery('(max-width: 760px)'), wide = useMediaQuery('(min-width: 1320px)')
  const [collapsed, setCollapsed] = useState(false), [navOpen, setNavOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false), [contextHidden, setContextHidden] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false), [sourceOpen, setSourceOpen] = useState(false), [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState(''), [linkError, setLinkError] = useState('')
  useEffect(() => {
    const dispose = () => store.dispose()
    // A lazy destination can suspend before unmount cleanup runs. Stop at the
    // navigation boundary, including Back/Forward, rather than waiting for it.
    const leaving = () => { if (location.hash !== '#/app' && !location.hash.startsWith('#/app?')) store.stop() }
    addEventListener('beforeunload', dispose)
    addEventListener('hashchange', leaving)
    return () => { store.stop(); removeEventListener('beforeunload', dispose); removeEventListener('hashchange', leaving) }
  }, [])
  useEffect(() => { if (session.screen === 'connected' || session.screen === 'error') setSourceOpen(false) }, [session.screen])
  const select = () => { store.openSources(); setSourceOpen(true) }
  const closeSources = () => { store.cancelSources(); setSourceOpen(false) }
  const busy = ['responding', 'executing', 'awaiting-approval'].includes(session.agent) || session.screen === 'selecting'
  const inlineContext = wide && !compact
  const navigation = <>
    <div className={s.sidebarBrand}><Brand href="#top" className={s.brand} />{!narrow && <button className={s.sidebarIcon} aria-label={collapsed ? 'ขยายแถบด้านข้าง' : 'ยุบแถบด้านข้าง'} onClick={() => setCollapsed(value => !value)}><Icon name="menu" /></button>}</div>
    <button className={s.newChat} aria-label="แชตใหม่" onClick={() => { store.newSession(); setNavOpen(false) }}><Icon name="plus" /><span>แชตใหม่</span></button>
    <div className={s.history}><p>แชตในครั้งนี้</p>{state.sessions.map(item => <button key={item.id} className={item.id === session.id ? s.selectedChat : ''} aria-label={`เปิดแชต ${item.title}`} aria-current={item.id === session.id ? 'page' : undefined} title={item.title} onClick={() => { store.switchSession(item.id); setNavOpen(false) }}><Icon name="work" size={17} /><span>{item.title}</span></button>)}</div>
    <div className={s.sidebarBottom}><p>เก็บแชตไว้ชั่วคราว<br />จนกว่าจะรีเฟรชหรือปิดหน้า</p><button aria-label="ตั้งค่า" onClick={() => { setNavOpen(false); setSettingsOpen(true) }}><Icon name="structure" size={18} /><span>ตั้งค่า</span></button><a href="#top" aria-label="กลับหน้าแนะนำ"><Icon name="arrow" size={18} /><span>กลับหน้าแนะนำ</span></a></div>
  </>
  return <div className={`${s.workspace} ${compact ? s.compact : ''} ${collapsed ? s.collapsed : ''}`}>
    {!compact && !narrow && <aside className={s.sidebar} aria-label="ประวัติแชต">{navigation}</aside>}
    <main className={s.main}>
      <header className={s.header}>
        <div className={s.topRow}><div className={s.titleGroup}>{!compact && narrow && <button className={s.iconButton} aria-label="เปิดประวัติแชต" onClick={() => setNavOpen(true)}><Icon name="menu" /></button>}<span className={s.chatTitle}>{compact ? 'CIC' : session.title}</span><span className={s.previewBadge}>ตัวอย่างแอป</span></div><div className={s.headerActions}>
          <button className={s.layoutButton} aria-label={compact ? 'กลับ Workspace' : 'มุมมองกะทัดรัด'} title={compact ? 'กลับ Workspace' : 'มุมมองกะทัดรัด'} onClick={() => store.setLayout(compact ? 'expanded' : 'compact')}><Icon name={compact ? 'screen' : 'structure'} size={19} /><span>{compact ? 'กลับ Workspace' : 'มุมมองกะทัดรัด'}</span></button>
          <button className={s.stop} disabled={!busy} onClick={() => { store.stop(); setSourceOpen(false) }}><span aria-hidden="true">■</span> หยุดงาน</button>
        </div></div>
        <div className={s.controlsRow}><div className={s.modes} role="group" aria-label="โหมดผู้ช่วย">{modes.map(mode => <button key={mode.id} aria-pressed={session.mode === mode.id} title={mode.description} onClick={() => store.setMode(mode.id)}>{mode.label}</button>)}</div>
          <div className={s.contextTools}><button className={s.contextToggle} aria-label="เปิดบริบท" title={session.source?.name ?? 'รายละเอียดบริบทหน้าจอ'} aria-expanded={inlineContext ? !contextHidden : contextOpen} onClick={() => inlineContext ? setContextHidden(value => !value) : setContextOpen(true)}><span className={s.dot} data-active={session.mode !== 'chat' && !!session.source} /><span>{contextStatus(session)}</span><Icon name="screen" size={17} /></button>{!session.source && <button className={s.sourceShortcut} onClick={select}>เลือกหน้าจอจำลอง</button>}</div>
        </div>
      </header>
      <div className={s.chatArea}><Chat key={session.id} session={session} store={store} onSelect={select} onLink={() => { setLink(''); setLinkError(''); setLinkOpen(true) }} /></div>
      <div className={s.agentStatus} role="status" aria-live="polite">{status[session.agent]}{compact && <a href="#top">กลับหน้าแนะนำ ↗</a>}</div>
    </main>
    {inlineContext && <aside className={`${s.contextPanel} ${contextHidden ? s.hiddenPanel : ''} ${session.mode === 'chat' ? s.quietContext : ''}`} aria-label="บริบทหน้าจอ" inert={contextHidden} aria-hidden={contextHidden}><div className={s.panelHeading}><h2>บริบทหน้าจอ</h2><button className={s.iconButton} aria-label="ซ่อนบริบท" onClick={() => setContextHidden(true)}><Icon name="close" size={18} /></button></div><ContextPanel session={session} store={store} onSelect={select} /></aside>}
    <Modal open={contextOpen && !inlineContext} title="บริบทหน้าจอ" onClose={() => setContextOpen(false)} drawer><ContextPanel session={session} store={store} onSelect={select} /></Modal>
    <Modal open={navOpen && narrow && !compact} title="แชตของคุณ" onClose={() => setNavOpen(false)} drawer><nav className={s.mobileNav} aria-label="ประวัติแชต">{navigation}</nav></Modal>
    <Modal open={sourceOpen} title="ลองเลือกหน้าจอ" onClose={closeSources}>
      <p className={s.modalIntro}>เลือกแหล่งตัวอย่างเพื่อทดลองบริบท ไม่มีการเข้าถึงหน้าจอจริง</p>
      <div className={s.sourceOptions}>{([{ kind: 'desktop', label: 'ทั้งหน้าจอ', detail: 'โต๊ะทำงานตัวอย่าง' }, { kind: 'window', label: 'หน้าต่างโปรแกรม', detail: 'หน้าต่างตัวอย่าง — VS Code' }, { kind: 'tab', label: 'แท็บเบราว์เซอร์', detail: 'แท็บตัวอย่าง — แผนงาน' }] as { kind: SourceKind; label: string; detail: string }[]).map(source => <button key={source.kind} onClick={() => store.selectSource(source.kind)}><Icon name="screen" /><span><b>{source.label}</b><small>{source.detail}</small></span><Icon name="arrow" size={17} /></button>)}<button disabled><Icon name="screen" /><span><b>พื้นที่เฉพาะบนจอ</b><small>ยังไม่รองรับใน preview</small></span></button></div>
    </Modal>
    <Modal open={linkOpen} title="แนบลิงก์" onClose={() => setLinkOpen(false)}><form onSubmit={event => { event.preventDefault(); try { store.addLink(link); setLinkOpen(false) } catch (error) { setLinkError(error instanceof Error ? error.message : 'ลิงก์ไม่ถูกต้อง') } }}><p className={s.modalIntro}>เพิ่ม URL เป็นข้อมูลประกอบ ตัวอย่างนี้จะไม่เปิดอ่านลิงก์</p><label className={s.field}>URL (http / https)<input type="text" inputMode="url" value={link} onChange={event => setLink(event.target.value)} placeholder="https://example.com" autoComplete="off" /></label>{linkError && <p className={s.error} role="alert">{linkError}</p>}<button className={s.primary} type="submit" disabled={!link.trim()}>เพิ่มลิงก์</button></form></Modal>
    <Modal open={settingsOpen} title="ตั้งค่า" onClose={() => setSettingsOpen(false)}><p className={s.modalIntro}>พื้นที่ทดลองของคุณ</p><div className={s.settingsRow}><b>การเชื่อมต่อ</b><span>บริการจำลองภายในหน้าเว็บ</span></div><div className={s.settingsRow}><b>แชตและภาพ</b><span>เก็บในหน่วยความจำ ไม่บันทึกลงอุปกรณ์อัตโนมัติ</span></div><div className={s.settingsRow}><b>การเคลื่อนไหว</b><span>ใช้ค่าลดการเคลื่อนไหวจากระบบของคุณ</span></div><p className={s.modalIntro}>ยังไม่มีบัญชีผู้ใช้ การเชื่อมต่อ AI หรือการควบคุมเครื่องจริง</p></Modal>
  </div>
}
