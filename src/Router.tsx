import { lazy, Suspense, useEffect, useState } from 'react'
const VoicePage=lazy(()=>import('./voice/VoicePage'))
const YouTubePage=lazy(()=>import('./youtube/YouTubePage'))
const NotepadPage=lazy(()=>import('./notepad/NotepadPage'))
const LabPage=lazy(()=>import('./lab/LabPage'))
const CorePage=lazy(()=>import('./core/CorePage'))
const OcrPage=lazy(()=>import('./ocr/OcrPage'))
const ScreenPage = lazy(() => import('./screen/ScreenPage'))
const Landing = lazy(() => import('./App'))
const ChessPage = lazy(() => import('./chess/ChessPage'))
const SlidesPage = lazy(() => import('./slides/SlidesPage'))
const Workspace = lazy(() => import('./workspace/Workspace'))

export default function Router() {
  const [hash, setHash] = useState(location.hash)
  const voice=hash==='#/voice'
  const youtube=hash==='#/youtube'
  const notepad=hash==='#/notepad'
  const lab=hash==='#/lab'
  const core=hash==='#/core'
  const ocr=hash==='#/ocr'
  const screen = hash === '#/screen'
  const slides = hash === '#/slides'
  const chess = hash === '#/chess'
  const app = hash === '#/app' || hash.startsWith('#/app?')
  useEffect(() => {
    const update = () => setHash(location.hash)
    addEventListener('hashchange', update)
    return () => removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    document.title = voice ? 'CIC Bot — ทดลองเสียงไทย' : youtube ? 'CIC Bot — เปิดเพลงด้วย CIC' : notepad ? 'CIC Bot — ควบคุม Notepad ใหม่' : lab ? 'CIC Bot — ทดลองควบคุมเฉพาะ Lab' : core ? 'CIC Bot — Core และความสามารถจริง' : ocr ? 'CIC Bot — OCR ในเครื่อง' : screen ? 'CIC Bot — แชร์หน้าต่างอ่านอย่างเดียว' : slides ? 'CIC Bot — สไลด์ในเครื่อง' : chess ? 'CIC Bot — หมากรุกในเครื่อง' : app ? 'CIC Bot — ตัวอย่างแอป' : 'CIC Bot — ผู้ช่วย AI ข้างหน้าจอคุณ'
    if (app || chess || slides || screen || ocr || core || lab || notepad || youtube || voice) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [app, chess, slides, screen, ocr, core, lab, notepad, youtube, voice])
  return <Suspense fallback={<p className="route-loading" role="status">กำลังเปิด CIC…</p>}>{voice ? <VoicePage/> : youtube ? <YouTubePage/> : notepad ? <NotepadPage/> : lab ? <LabPage/> : core ? <CorePage/> : ocr ? <OcrPage/> : screen ? <ScreenPage /> : slides ? <SlidesPage /> : chess ? <ChessPage /> : app ? <Workspace /> : <Landing />}</Suspense>
}
