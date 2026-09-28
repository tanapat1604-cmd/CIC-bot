import { lazy, Suspense, useEffect, useState } from 'react'
const Landing = lazy(() => import('./App'))
const Workspace = lazy(() => import('./workspace/Workspace'))

export default function Router() {
  const [hash, setHash] = useState(location.hash)
  const app = hash === '#/app' || hash.startsWith('#/app?')
  useEffect(() => {
    const update = () => setHash(location.hash)
    addEventListener('hashchange', update)
    return () => removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    document.title = app ? 'CIC Bot — ตัวอย่างแอป' : 'CIC Bot — ผู้ช่วย AI ข้างหน้าจอคุณ'
    if (app) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [app])
  return <Suspense fallback={<p className="route-loading" role="status">กำลังเปิด CIC…</p>}>{app ? <Workspace /> : <Landing />}</Suspense>
}
