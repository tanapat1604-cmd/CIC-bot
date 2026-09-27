import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import SceneFallback from './SceneFallback'

const Scene = lazy(() => import('./Scene'))
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children }
}

export default function SceneView({ step = 0, variant = 'hero' }: { step?: number; variant?: 'hero' | 'story' }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [visited, setVisited] = useState(false)
  const [tabActive, setTabActive] = useState(!document.hidden)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { setVisible(entry.isIntersecting); if (entry.isIntersecting) setVisited(true) }, { threshold: 0.05 })
    if (host.current) observer.observe(host.current)
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(preference.matches)
    const visibility = () => setTabActive(!document.hidden)
    preference.addEventListener('change', update)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); preference.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  return <div ref={host} className={`scene-view scene-${variant}`} role="img" aria-label="ตัวอย่างคอนเซปต์ 3 มิติ: จอคอมพิวเตอร์และผู้ช่วย AI ทรงกลม พร้อมแผงงานลอยอยู่รอบจอ" data-active={visible && tabActive} data-reduced-motion={reduced}>
    <div className="scene-grid" />
    <SceneBoundary><Suspense fallback={<SceneFallback />}>{visited ? <Scene step={step} reduced={reduced} active={visible && tabActive} /> : <SceneFallback />}</Suspense></SceneBoundary>
    <span className="scene-caption"><span /> ตัวอย่างคอนเซปต์ <span className="scene-caption-end">CIC / 01</span></span>
  </div>
}
