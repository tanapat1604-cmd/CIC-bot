import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import SceneFallback from './SceneFallback'
import { useMediaQuery } from './useMotion'
import type { SceneInput } from './sceneMotion'

const Scene = lazy(() => import('./Scene'))
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function SceneView({ variant = 'hero' }: { variant?: 'hero' | 'story' }) {
  const host = useRef<HTMLDivElement>(null)
  const input = useRef<SceneInput>({ progress: 0, pointerX: 0, pointerY: 0 })
  const [visible, setVisible] = useState(false)
  const [visited, setVisited] = useState(false)
  const [tabActive, setTabActive] = useState(!document.hidden)
  const [renderer, setRenderer] = useState<'loading' | 'webgl' | 'fallback'>('loading')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const compact = useMediaQuery('(max-width: 650px)')
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')
  const ready = useCallback(() => setRenderer('webgl'), [])
  const failure = useCallback(() => setRenderer('fallback'), [])

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting) setVisited(true)
    }, { threshold: 0.05 })
    if (host.current) observer.observe(host.current)
    const visibility = () => {
      setTabActive(!document.hidden)
      if (document.hidden) { input.current.pointerX = 0; input.current.pointerY = 0 }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  useEffect(() => {
    if (variant !== 'story') return
    const layout = host.current?.closest<HTMLElement>('.story-layout')
    if (!layout) return
    let frame = 0
    const measure = () => {
      frame = 0
      const rect = layout.getBoundingClientRect()
      const firstHeight = layout.querySelector<HTMLElement>('.story-step')?.offsetHeight ?? 300
      const start = rect.top + firstHeight / 2 - innerHeight * 0.5
      input.current.progress = Math.max(0, Math.min(1, -start / Math.max(1, rect.height - firstHeight)))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const resize = new ResizeObserver(schedule)
    resize.observe(layout)
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) }
  }, [variant])

  return <div ref={host} className={`scene-view scene-${variant}`} role="img" aria-label="ตัวอย่างคอนเซปต์ 3 มิติ: จอคอมพิวเตอร์และผู้ช่วย AI ทรงกลม พร้อมแผงงานลอยอยู่รอบจอ" data-active={visible && tabActive} data-reduced-motion={reduced} data-renderer={renderer}
    onPointerMove={event => {
      if (reduced || compact || !finePointer || event.pointerType === 'touch') return
      const rect = event.currentTarget.getBoundingClientRect()
      input.current.pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1))
      input.current.pointerY = Math.max(-1, Math.min(1, 1 - (event.clientY - rect.top) / rect.height * 2))
    }}
    onPointerLeave={() => { input.current.pointerX = 0; input.current.pointerY = 0 }}>
    <div className="scene-grid" />
    <div className="scene-placeholder" aria-hidden="true"><SceneFallback /></div>
    <div className="scene-canvas" aria-hidden="true">
      <SceneBoundary onFailure={failure}><Suspense fallback={null}>{visited && <Scene reduced={reduced} active={visible && tabActive} compact={compact} input={input} onReady={ready} onFailure={failure} />}</Suspense></SceneBoundary>
    </div>
    <span className="scene-caption"><span /> ตัวอย่างคอนเซปต์{renderer === 'fallback' ? ' · ภาพสำรอง' : ''}<span className="scene-caption-end">CIC / 01</span></span>
  </div>
}
