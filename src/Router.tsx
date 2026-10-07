import { lazy, Suspense, useEffect, useState } from 'react'
const Landing = lazy(() => import('./App'))
const ChessPage = lazy(() => import('./chess/ChessPage'))
const SlidesPage = lazy(() => import('./slides/SlidesPage'))
const Workspace = lazy(() => import('./workspace/Workspace'))

export default function Router() {
  const [hash, setHash] = useState(location.hash)
  const slides = hash === '#/slides'
  const chess = hash === '#/chess'
  const app = hash === '#/app' || hash.startsWith('#/app?')
  useEffect(() => {
    const update = () => setHash(location.hash)
    addEventListener('hashchange', update)
    return () => removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    document.title = slides ? 'CIC Bot — สไลด์ในเครื่อง' : chess ? 'CIC Bot — หมากรุกในเครื่อง' : app ? 'CIC Bot — ตัวอย่างแอป' : 'CIC Bot — ผู้ช่วย AI ข้างหน้าจอคุณ'
    if (app || chess || slides) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [app, chess, slides])
  return <Suspense fallback={<p className="route-loading" role="status">กำลังเปิด CIC…</p>}>{slides ? <SlidesPage /> : chess ? <ChessPage /> : app ? <Workspace /> : <Landing />}</Suspense>
}
