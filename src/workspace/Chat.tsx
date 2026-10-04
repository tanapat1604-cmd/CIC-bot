import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon, { type IconName } from '../Icon'
import { useMediaQuery } from '../useMotion'
import type { Attachment, Session, SessionStore } from './types'
import s from './Workspace.module.css'
import { CAPABILITY_NOTICE, UTILITY_HELP } from '../../shared/capabilities'
import { LIMITS } from '../../shared/chatProtocol'

const prompts: { icon: IconName; title: string; text: string }[] = [
  { icon: 'screen', title: 'วิเคราะห์หน้าจอ', text: 'ช่วยแนะนำวิธีวิเคราะห์งานบนหน้าจอให้หน่อย' },
  { icon: 'work', title: 'วางแผนงาน', text: 'ช่วยวางแผนงานวันนี้เป็นขั้นตอนที่ทำตามได้' },
  { icon: 'code', title: 'ดูโค้ด', text: 'ช่วยแนะนำวิธีตรวจโค้ดและยกตัวอย่างสั้น ๆ' },
  { icon: 'design', title: 'คิดโปสเตอร์', text: 'ช่วยคิดแนวทางออกแบบโปสเตอร์ให้อ่านง่าย' },
]
function MessageText({ text }: { text: string }) {
  return <>{text.split(/(```[\s\S]*?```)/g).map((part, index) => part.startsWith('```') ? <pre className={s.codeBlock} key={index}><code>{part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code></pre> : <p className={s.messageText} key={index}>{part}</p>)}</>
}
export function Attachments({ items, onRemove }: { items: Attachment[]; onRemove?: (id: string) => void }) {
  return <div className={s.attachments}>{items.map(item => <div className={s.attachment} key={item.id}>
    {item.kind === 'image' ? <img src={item.url} alt={`ภาพแนบ ${item.name}`} /> : <Icon name="arrow" size={16} />}
    <div><b>{item.name}</b>{item.kind === 'link' && <span title={item.url}>{item.url}</span>}</div>
    {onRemove && <button type="button" className={s.iconButton} aria-label={`ลบ ${item.name}`} onClick={() => onRemove(item.id)}><Icon name="close" size={15} /></button>}
  </div>)}</div>
}
const actionLabels = { pending: 'รอคุณอนุญาต', executing: 'กำลังทำการจำลอง', done: 'เสร็จแล้ว · ผลจำลอง', cancelled: 'ยกเลิกแล้ว', rejected: 'ปฏิเสธแล้ว', error: 'การจำลองไม่สำเร็จ' }
export default function Chat({ session, store, onSelect, onLink }: { session: Session; store: SessionStore; onSelect: () => void; onLink: () => void }) {
  const scroll = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null), file = useRef<HTMLInputElement>(null)
  const nearEnd = useRef(true), composing = useRef(false)
  const [unread, setUnread] = useState(false), [attachmentError, setAttachmentError] = useState('')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const busy = ['responding', 'executing'].includes(session.agent)
  const demo = session.connection === 'demo'
  const replyLabel = demo ? 'คำตอบจำลอง CIC' : session.connection === 'test' ? 'คำตอบทดสอบ backend' : 'คำตอบ CIC'
  const latest = session.messages.at(-1)
  useLayoutEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(input.current.scrollHeight, 144)}px`
  }, [session.draft])
  useLayoutEffect(() => {
    if (!session.messages.length) scroll.current?.scrollTo({ top: 0, behavior: 'instant' })
    else if (nearEnd.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: reduced || latest?.responseStatus === 'streaming' ? 'instant' : 'smooth' })
    else setUnread(true)
  }, [session.messages, session.agent, reduced, latest?.responseStatus])
  useEffect(() => {
    const element = scroll.current!
    const observer = new ResizeObserver(() => {
      if (nearEnd.current && session.messages.length) element.scrollTo({ top: element.scrollHeight, behavior: 'instant' })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [session.messages.length])
  function send() { if (!busy && session.draft.trim()) { store.send(); setAttachmentError(''); input.current?.focus({ preventScroll: true }) } }
  return <>
    <div className={s.chatScroll} ref={scroll} onScroll={() => {
      const el = scroll.current!
      nearEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      if (nearEnd.current) setUnread(false)
    }} tabIndex={0} aria-label="ข้อความในแชต">
      <div className={s.chatContent}>
        {session.messages.length === 0 ? <div className={s.empty}>
          <span className={s.botMark}><Icon name="spark" size={28} /></span><p className={s.eyebrow}>YOUR EVERYDAY COMPANION</p><h1>วันนี้อยากให้ CIC<br />ช่วยเรื่องอะไร?</h1><p>เริ่มจากสิ่งที่คุณกำลังคิด<br />เราค่อย ๆ หาทางไปด้วยกัน</p>
          <div className={s.prompts}>{prompts.filter(prompt => demo || prompt.icon !== 'screen').map(prompt => <button key={prompt.title} onClick={() => { store.setDraft(prompt.text); input.current?.focus() }}><Icon name={prompt.icon} /><span>{prompt.title}</span><Icon name="arrow" size={15} /></button>)}</div>
        </div> : <div className={s.messages}>{session.messages.map(message => <article className={`${s.message} ${message.role === 'user' ? s.user : s.assistant}`} key={message.id} aria-label={message.role === 'user' ? 'ข้อความของคุณ' : replyLabel}>
          <div className={s.messageLabel}>{message.role === 'user' ? 'คุณ' : <><span className={s.smallBot}>C</span>CIC <small>{demo ? 'คำตอบจำลอง' : session.connection === 'test' ? 'ทดสอบ backend · ไม่ใช่ AI' : message.replySource === 'calculator' ? 'เครื่องคำนวณในเครื่อง · ไม่ใช่โมเดล' : message.replySource === 'time-calculator' ? 'คำนวณเวลาในเครื่อง · ไม่ใช่โมเดล' : message.replySource === 'mixed' ? 'คำตอบหลายส่วน · ดูแหล่งในแต่ละส่วน' : message.replySource === 'help' ? 'คำแนะนำจากระบบ · ไม่ใช่ AI' : message.replySource === 'capabilities' ? 'ข้อมูลความสามารถจากระบบ' : !message.replySource ? 'รอข้อมูลแหล่งคำตอบจาก backend' : "AI ในเครื่อง · " + (session.model ?? 'Ollama')}</small></>}</div>
          <MessageText text={message.text} />
          {session.connection === 'live' && message.role === 'assistant' && message.responseStatus === 'complete' && <p className={s.responseState}>{message.replySource === 'mixed' ? 'จบคำตอบหลายส่วน · ไม่มีการทำงานภายนอก ส่วนโมเดลอาจคลาดเคลื่อน' : message.replySource && message.replySource !== 'model' ? 'ส่งผลจากระบบแล้ว · ไม่มีการทำงานภายนอก' : 'ส่งคำตอบจากโมเดลแล้ว · ยังไม่ได้ทำงานภายนอก ข้อความอาจคลาดเคลื่อน'}</p>}
          {message.responseStatus && message.responseStatus !== 'complete' && <p className={s.responseState}>{message.responseStatus === 'streaming' ? 'กำลังทยอยตอบ…' : message.responseStatus === 'stopped' ? 'หยุดกลางทาง · คำตอบนี้ยังไม่ครบ' : 'ตอบไม่สำเร็จ · คำตอบนี้ยังไม่ครบ'}</p>}
          {session.connection === 'live' && message.role === 'assistant' && message.responseStatus !== 'complete' && <p className={s.responseState}>ยังไม่ได้ทำงานภายนอก · ข้อความ AI ไม่ใช่ผลการทำงานจริง</p>}
          {!!message.attachments?.length && <Attachments items={message.attachments} />}
          {message.action && <div className={s.approval} data-status={message.action.status}>
            <span className={s.actionStatus}>{actionLabels[message.action.status]}</span> <small className={s.responseState}>การจำลอง</small><h3>{message.action.title}</h3><dl><dt>เป้าหมาย</dt><dd>{message.action.target}</dd><dt>รายละเอียดที่จะใช้</dt><dd className={s.actionDetails}>{message.action.details}</dd><dt>ผลที่คาดว่าจะเกิด</dt><dd>{message.action.effect}</dd></dl>
            {message.action.status === 'pending' && <div className={s.actionButtons}><button className={s.primary} onClick={() => store.approve(message.action!.id)}>อนุญาตการจำลองนี้</button><button className={s.secondary} onClick={() => store.reject(message.action!.id)}>ปฏิเสธ</button></div>}
          </div>}
        </article>)}</div>}
        {session.mode !== 'chat' && !session.source && <div className={s.contextHint}><Icon name="screen" size={18} /><span>คุยต่อได้ หรือเพิ่มบริบทจำลอง</span><button onClick={onSelect}>เลือกแหล่ง</button></div>}
        {session.contextNotice && <p className={s.working}>ใช้เฉพาะประวัติช่วงล่าสุดที่อยู่ในขีดจำกัด ไม่ส่งคำตอบที่หยุดหรือผิดพลาด</p>}
        {session.agent === 'responding' && latest?.responseStatus !== 'streaming' && <p className={s.working}>{demo ? 'กำลังเตรียมคำตอบจำลอง…' : 'กำลังรอคำตอบจาก backend… · ยังไม่ทราบแหล่งคำตอบ'}</p>}
        {session.agent === 'paused' && <p className={s.working}>หยุดงานแล้ว · {session.source ? `ยังเลือก ${session.source.name} ไว้${session.mode === 'chat' ? ' แต่ไม่ใช้ในโหมดคุย' : ''}` : 'ไม่มีบริบทที่เลือกไว้'} ส่งข้อความใหม่ได้เมื่อพร้อม</p>}
        {session.error && <div className={s.error} role="alert">{session.error}{session.agent === 'error' && session.retryText && <button className={s.secondary} onClick={() => store.retry()}>ลองอีกครั้ง</button>}</div>}
      </div>
    </div>
    <div className={s.composerArea}>
      {session.connection === 'live' && <p className={s.responseState}>{CAPABILITY_NOTICE}</p>}
      {unread && <button className={s.unread} onClick={() => { nearEnd.current = true; setUnread(false); scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: reduced ? 'instant' : 'smooth' }) }}>ข้อความใหม่ ↓</button>}
      <form className={s.composer} onSubmit={event => { event.preventDefault(); send() }}>
        {!!session.attachments.length && <Attachments items={session.attachments} onRemove={id => store.removeAttachment(id)} />}
        <textarea ref={input} rows={1} value={session.draft} placeholder="บอก CIC ว่าอยากทำอะไร…" aria-label="ข้อความถึง CIC" maxLength={demo ? 20000 : LIMITS.messageChars} onChange={event => store.setDraft(event.target.value)} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) { event.preventDefault(); send() } }} />
        <div className={s.composerTools}><div><button type="button" className={s.attachButton} disabled={!demo} title={!demo ? 'พิมพ์ URL เป็นข้อความได้ แต่ไม่ได้เปิดอ่านเว็บ' : undefined} onClick={onLink}><Icon name="arrow" size={17} />ลิงก์</button><button type="button" className={s.attachButton} disabled={!demo} title={!demo ? 'backend ยังไม่รองรับภาพ' : undefined} onClick={() => file.current?.click()}><Icon name="design" size={17} />รูปภาพ</button></div><button type="submit" className={s.send} disabled={!session.draft.trim() || busy} aria-label="ส่งข้อความ"><Icon name="arrow" size={20} /></button></div>
      </form>
      <input className={s.fileInput} disabled={!demo} ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="แนบรูปภาพ" onChange={async event => {
        const selected = event.target.files?.[0]; event.target.value = ''; setAttachmentError('')
        if (selected) { try { await store.addImage(selected) } catch (error) { setAttachmentError(error instanceof Error ? error.message : 'แนบภาพไม่สำเร็จ') } }
      }} />
      {session.connection === 'live' && <details className={s.attachmentHelp}><summary>ความสามารถจริงของ CIC</summary><p>{CAPABILITY_NOTICE}</p><p>{UTILITY_HELP}</p><p>คำตอบจากโมเดลไม่ใช่หลักฐานว่างานภายนอกสำเร็จ</p></details>}
      {attachmentError && <p className={s.error} role="alert">{attachmentError}</p>}
      <div className={s.composerNote}>แชตและสิ่งแนบหายเมื่อรีเฟรช {demo ? <details className={s.attachmentHelp}><summary>ข้อจำกัดสิ่งแนบ</summary><p>สูงสุด 6 รายการต่อข้อความ · ภาพ PNG/JPEG/WebP/GIF ไม่เกิน 5 MB และ 24 ล้านพิกเซล · ภาพอยู่ในเครื่อง ไม่อัปโหลด และไม่เปิดอ่าน URL</p></details> : <details className={s.attachmentHelp}><summary>ข้อจำกัดแชตข้อความ</summary><p>ไม่เปิดอ่าน URL · ข้อความไม่เกิน 8,000 ตัวอักษร ใช้ประวัติล่าสุดไม่เกิน 24 ข้อความ รวม 24,000 ตัวอักษร · การหยุดไม่รับประกันการยกเลิกค่าใช้จ่ายที่เกิดแล้ว{session.connection === 'test' && ' · backend ทดสอบนี้ไม่เสียเงินและไม่ใช่ AI'}</p></details>}</div>
    </div>
  </>
}
