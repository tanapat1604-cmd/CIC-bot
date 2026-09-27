import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Icon from './Icon'
import SceneView from './SceneView'
import { capabilities, faqs, stories } from './content'
import { siteConfig } from './config'

function Brand({ light = false }: { light?: boolean }) {
  return <a className={`brand ${light ? 'brand-light' : ''}`} href="#top" aria-label="CIC Bot กลับด้านบน"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M27 9a14 14 0 1 0 0 22" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" /><circle cx="26" cy="20" r="4" fill="currentColor" /></svg><span>CIC<span className="brand-bot"> Bot</span></span></a>
}

type Action = 'app' | 'download'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [storyStep, setStoryStep] = useState(0)
  const [dialogAction, setDialogAction] = useState<Action>('app')
  const dialog = useRef<HTMLDialogElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const storyItems = useRef<(HTMLElement | null)[]>([])
  const menuButton = useRef<HTMLButtonElement>(null)
  const selected = capabilities[activeTab]

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setStoryStep(Number((entry.target as HTMLElement).dataset.step))
    }, { rootMargin: '-30% 0px -35% 0px' })
    storyItems.current.forEach(element => { if (element) observer.observe(element) })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus() }
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])

  function openAction(action: Action) {
    const url = action === 'app' ? siteConfig.appUrl : siteConfig.downloadUrl
    if (url) { window.location.assign(url); return }
    setDialogAction(action)
    setMenuOpen(false)
    dialog.current?.showModal()
  }

  function closeDialog() { dialog.current?.close() }
  function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % capabilities.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + capabilities.length) % capabilities.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = capabilities.length - 1
    else return
    event.preventDefault(); setActiveTab(next); tabs.current[next]?.focus()
  }

  const actionButtons = (className = '') => <div className={`action-buttons ${className}`}><button className="button button-outline" onClick={() => openAction('app')}>เข้าใช้งาน <Icon name="arrow" size={17} /></button><button className="button button-primary" onClick={() => openAction('download')}><Icon name="download" size={17} /> ดาวน์โหลด</button></div>

  return <>
    <a href="#main" className="skip-link">ข้ามไปยังเนื้อหา</a>
    <header className="header">
      <div className="header-inner wrap">
        <Brand />
        <nav aria-label="เมนูหลัก" className={`navigation ${menuOpen ? 'is-open' : ''}`} id="main-navigation">
          <a href="#about" onClick={() => setMenuOpen(false)}>รู้จัก CIC</a>
          <a href="#capabilities" onClick={() => setMenuOpen(false)}>ช่วยอะไรได้บ้าง</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>วิธีทำงาน</a>
        </nav>
        <div className="header-actions"><span className="coming-soon">เร็ว ๆ นี้</span>{actionButtons()}</div>
        <button className="menu-toggle" ref={menuButton} aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
    </header>
    <main id="main">
      <section className="hero" id="top">
        <div className="wrap hero-layout">
          <div className="hero-copy">
            <div className="eyebrow"><span className="little-line" /> YOUR EVERYDAY AI COMPANION</div>
            <h1>เห็นหน้าจอ<br />เดียวกับคุณ<br /><span>ช่วยคิดไปกับทุกงาน</span><span className="heading-dot">.</span></h1>
            <p className="hero-description">CIC Bot คือแนวคิดผู้ช่วย AI ที่เข้าใจสิ่งที่คุณกำลังทำผ่านหน้าจอที่คุณเลือกแชร์ พร้อมช่วยวิเคราะห์ วางแผน และแนะนำขั้นตอน ตั้งแต่งานประจำวันและเกม ไปจนถึงงานออกแบบและการสร้างแอป</p>
            <a className="button button-primary hero-cta" href="#capabilities">สำรวจความสามารถ <Icon name="arrow" /></a>
            <div className="development-note"><span className="status-dot" /> อยู่ระหว่างพัฒนา <span className="note-divider" /> เริ่มต้นจากความเป็นไปได้</div>
          </div>
          <div className="hero-visual"><div className="visual-coordinate">DESIGNED TO THINK WITH YOU</div><SceneView /><div className="floating-label"><span className="label-icon"><Icon name="spark" /></span><div>อีกหนึ่งมุมมอง ให้ทุกงานของคุณ<small>YOUR DIGITAL SIDEKICK</small></div></div></div>
        </div>
        <div className="hero-bottom wrap"><span>คุณมีเป้าหมาย ให้ CIC ช่วยมองหาวิธี</span><a href="#about">เลื่อนเพื่อรู้จักเรา <span>↓</span></a></div>
      </section>

      <div className="possibility-strip" aria-label="หมวดความสามารถที่วางแผนไว้"><div className="wrap">{capabilities.map((item, i) => <span key={item.id}><Icon name={item.icon} size={21} />{item.title}{i < 4 && <i />}</span>)}</div></div>

      <section className="about-section section-pad" id="about">
        <div className="wrap"><div className="section-heading"><p className="eyebrow">01 / MEET YOUR SIDEKICK</p><div><h2>มีคนช่วยมอง<br />มีทางไปต่อ<span className="blue">.</span></h2><p className="section-intro">จากสิ่งที่เห็น สู่สิ่งที่เข้าใจ<br />นี่คือแนวคิดของผู้ช่วยที่อยู่ข้างคุณ</p></div></div>
          <div className="story-layout">
            <div className="story-visual"><div className="story-visual-top"><span className="status-dot" /> CIC WORKSPACE <span>CONCEPT</span></div><SceneView variant="story" step={storyStep} /><div className="story-visual-bottom"><span>0{storyStep + 1} / 03</span><span>{stories[storyStep].tag}</span></div></div>
            <div className="story-steps">{stories.map((story, i) => <article key={story.title} data-step={i} ref={element => { storyItems.current[i] = element }} className={`story-step ${storyStep === i ? 'active' : ''}`}><span className="step-number">0{i + 1}</span><h3>{story.title}</h3><p>{story.text}</p><span className="story-tag">{story.tag}</span></article>)}</div>
          </div>
          <p className="concept-note">แนวทางของผลิตภัณฑ์ที่กำลังพัฒนา · ความสามารถจริงขึ้นอยู่กับขอบเขตและสิทธิ์ที่รองรับในอนาคต</p>
        </div>
      </section>

      <section className="capabilities-section section-pad" id="capabilities">
        <div className="wrap"><div className="section-heading"><p className="eyebrow">02 / A WORLD OF POSSIBILITIES</p><div><h2>หลายบทบาท<br />ผู้ช่วยคนเดียว<span className="blue">.</span></h2><p className="section-intro">ลองเลือกงานของคุณ แล้วมองภาพ<br />ว่า CIC อาจช่วยได้อย่างไร</p></div></div>
          <div className="capability-tabs" role="tablist" aria-label="ตัวอย่างความสามารถ">{capabilities.map((item, i) => <button key={item.id} ref={element => { tabs.current[i] = element }} role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={i === activeTab} tabIndex={i === activeTab ? 0 : -1} onClick={() => setActiveTab(i)} onKeyDown={event => navigateTabs(event, i)}><Icon name={item.icon} /><span>{item.title}</span><span className="tab-index">0{i + 1}</span></button>)}</div>
          <div role="tabpanel" id={`panel-${selected.id}`} aria-labelledby={`tab-${selected.id}`} tabIndex={0} className="capability-panel">
            <div className="capability-copy"><p className="eyebrow blue">{selected.kicker}</p><h3>{selected.heading}</h3><p>{selected.description}</p><ul>{selected.items.map(item => <li key={item}><Icon name="check" size={17} />{item}</li>)}</ul><span className="planned-label"><span className="status-dot" /> ความสามารถที่วางแผนไว้</span></div>
            <div className={`demo demo-${selected.id}`}><div className="demo-top"><div className="window-dots"><i /><i /><i /></div><span>ตัวอย่างคอนเซปต์</span><Icon name="screen" size={15} /></div>
              <div className="demo-screen"><div className="demo-document"><div className="document-title"><Icon name={selected.icon} size={18} />{selected.screen}</div><div className="document-content">{selected.rows.map((row, i) => <div key={row} className="document-row"><span className="row-marker">{selected.id === 'app' ? i + 1 : <Icon name="check" size={11} />}</span>{row}</div>)}</div><div className="document-lines"><i /><i /></div></div>
              <div className="demo-conversation"><p className="user-bubble">{selected.prompt}</p><div className="bot-reply"><span className="bot-avatar">C</span><div><b>CIC <span>ตัวอย่างคอนเซปต์</span></b><p>{selected.response}</p></div></div></div></div>
              <div className="demo-bottom"><span className="status-dot" /> ภาพจำลองแนวคิด · ไม่ใช่การทำงานของ AI จริง</div>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section section-pad" id="how-it-works"><div className="wrap"><div className="section-heading"><p className="eyebrow">03 / SIMPLE BY DESIGN</p><div><h2>เริ่มที่คุณ<br />ไปต่อด้วยกัน<span className="blue">.</span></h2><p className="section-intro">วิธีทำงานที่วางแผนไว้<br />เรียบง่าย และให้คุณเป็นคนเลือก</p></div></div><ol className="how-steps">{[{ title: 'เลือกหน้าจอ', text: 'เลือกสิ่งที่อยากแชร์ เพื่อให้ CIC เข้าใจบริบท', icon: 'screen' }, { title: 'บอกเป้าหมาย', text: 'เล่าสิ่งที่อยากทำ ด้วยภาษาที่เป็นคุณ', icon: 'work' }, { title: 'ช่วยกันวิเคราะห์', text: 'รับมุมมองและแนวทาง สำหรับขั้นตอนถัดไป', icon: 'spark' }, { title: 'คุณเป็นคนอนุญาต', text: 'เลือกวิธีช่วยและสิทธิ์ในการลงมือ หยุดได้ตามต้องการ', icon: 'shield' }].map((item, i) => <li key={item.title}><div className="how-step-top"><span>0{i + 1}</span><Icon name={item.icon as 'screen' | 'work' | 'spark' | 'shield'} size={28} /></div><h3>{item.title}</h3><p>{item.text}</p></li>)}</ol><div className="control-note"><Icon name="shield" /><p>คุณเลือกสิ่งที่แชร์ คุณเลือกวิธีช่วย <span>นี่คือแนวทางของผลิตภัณฑ์ที่กำลังพัฒนา</span></p></div></div></section>

      <section className="faq-section section-pad" id="faq"><div className="wrap faq-layout"><div><p className="eyebrow">04 / GOOD QUESTIONS</p><h2>อีกนิด<br />ก่อนรู้จักกัน<span className="blue">.</span></h2><p className="section-intro">คำถามที่คุณอาจกำลังสงสัย</p></div><div className="faq-list">{faqs.map(([question, answer], i) => <details key={question}><summary><span className="faq-number">0{i + 1}</span><span>{question}</span><Icon name="plus" /></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="closing"><div className="wrap"><p className="eyebrow">A LITTLE HELP. A LOT OF POSSIBILITY.</p><h2>จากสิ่งที่อยู่บนจอ<br />สู่สิ่งที่คุณอยากทำให้สำเร็จ<span>.</span></h2><p>ก้าวต่อไปของผู้ช่วยดิจิทัล กำลังเริ่มต้นที่นี่</p>{actionButtons('closing-actions')}<span className="closing-status">อยู่ระหว่างพัฒนา · พร้อมให้คุณรู้จัก ก่อนพร้อมใช้งาน</span><div className="closing-orbit" aria-hidden="true"><i /><i /><i /></div></div></section>
    </main>
    <footer><div className="wrap footer-inner"><Brand /><span>ผู้ช่วยดิจิทัลข้างหน้าจอคุณ</span><span className="footer-status"><span className="status-dot" /> อยู่ระหว่างพัฒนา</span><a href={siteConfig.repositoryUrl} target="_blank" rel="noreferrer">GitHub <Icon name="arrow" size={16} /><span className="sr-only"> (เปิดแท็บใหม่)</span></a></div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} CIC Bot</span><span>คิดไปด้วยกัน เติบโตไปด้วยกัน</span><a href="#top">กลับด้านบน ↑</a></div></footer>

    <dialog ref={dialog} className="status-dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description" onKeyDown={trapDialogFocus} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog() } }}>
      <button className="dialog-close" aria-label="ปิดหน้าต่าง" onClick={closeDialog} autoFocus><Icon name="close" /></button><div className="dialog-symbol"><Icon name={dialogAction === 'app' ? 'spark' : 'download'} size={30} /></div><p className="eyebrow blue">SOMETHING GOOD IS TAKING SHAPE</p><h2 id="dialog-title">กำลังพัฒนา<br />เพื่อเป็นผู้ช่วยของคุณ<span className="blue">.</span></h2><p id="dialog-description">{dialogAction === 'app' ? 'CIC Bot ยังไม่เปิดให้เข้าใช้งานจริง' : 'CIC Bot ยังไม่มีไฟล์ให้ดาวน์โหลด'} ขณะนี้อยู่ระหว่างพัฒนา ระหว่างนี้ลองสำรวจตัวอย่างคอนเซปต์และความสามารถที่เราวางแผนไว้ได้เลย</p><a href="#capabilities" className="button button-primary" onClick={() => { closeDialog(); setTimeout(() => document.getElementById(`tab-${selected.id}`)?.focus({ preventScroll: true }), 0) }}>ดูตัวอย่างคอนเซปต์ <Icon name="arrow" size={18} /></a><button className="dialog-dismiss" onClick={closeDialog}>ปิดหน้าต่าง</button>
    </dialog>
  </>
}
